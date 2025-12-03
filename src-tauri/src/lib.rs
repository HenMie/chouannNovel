// 了解更多关于 Tauri 命令的信息: https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Rust 的问候!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 数据库迁移
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                -- 项目表
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- 工作流表
                CREATE TABLE IF NOT EXISTS workflows (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    loop_max_count INTEGER DEFAULT 10,
                    timeout_seconds INTEGER DEFAULT 300,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                -- 节点表
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    config TEXT NOT NULL DEFAULT '{}',
                    order_index INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
                );

                -- 设定库表
                CREATE TABLE IF NOT EXISTS settings (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                -- 设定注入提示词表
                CREATE TABLE IF NOT EXISTS setting_prompts (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    category TEXT NOT NULL,
                    prompt_template TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                -- 全局配置表
                CREATE TABLE IF NOT EXISTS global_config (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    ai_providers TEXT NOT NULL DEFAULT '{}',
                    theme TEXT DEFAULT 'system',
                    default_loop_max INTEGER DEFAULT 10,
                    default_timeout INTEGER DEFAULT 300
                );

                -- 执行记录表
                CREATE TABLE IF NOT EXISTS executions (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input TEXT,
                    final_output TEXT,
                    variables_snapshot TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    finished_at DATETIME,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
                );

                -- 节点执行结果表
                CREATE TABLE IF NOT EXISTS node_results (
                    id TEXT PRIMARY KEY,
                    execution_id TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    iteration INTEGER DEFAULT 1,
                    input TEXT,
                    output TEXT,
                    status TEXT NOT NULL,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    finished_at DATETIME,
                    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
                );

                -- 插入默认全局配置
                INSERT OR IGNORE INTO global_config (id, ai_providers, theme)
                VALUES (1, '{}', 'system');
            "#,
            kind: MigrationKind::Up,
        },
        // 迁移 2: 添加块结构支持
        Migration {
            version: 2,
            description: "add_block_structure_support",
            sql: r#"
                -- 添加块结构字段到节点表
                ALTER TABLE nodes ADD COLUMN block_id TEXT;
                ALTER TABLE nodes ADD COLUMN parent_block_id TEXT;
            "#,
            kind: MigrationKind::Up,
        },
        // 迁移 3: 添加节点执行配置详情
        Migration {
            version: 3,
            description: "add_resolved_config_to_node_results",
            sql: r#"
                -- 添加解析后的配置字段到节点结果表（用于存储执行时的实际配置）
                ALTER TABLE node_results ADD COLUMN resolved_config TEXT;
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            Builder::default()
                .add_migrations("sqlite:chouann_novel.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
