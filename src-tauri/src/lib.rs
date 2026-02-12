// 了解更多关于 Tauri 命令的信息: https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Rust 的问候!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 数据库初始化
    let migrations = vec![Migration {
        version: 1,
        description: "init_database",
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
                block_id TEXT,
                parent_block_id TEXT,
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
                resolved_config TEXT,
                status TEXT NOT NULL,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME,
                FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
            );

            -- 工作流版本历史表
            CREATE TABLE IF NOT EXISTS workflow_versions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                snapshot TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
            );

            -- 插入默认全局配置
            INSERT OR IGNORE INTO global_config (id, ai_providers, theme)
            VALUES (1, '{}', 'system');

            -- 性能优化索引：工作流表
            CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);
            CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);

            -- 性能优化索引：节点表
            CREATE INDEX IF NOT EXISTS idx_nodes_workflow_id ON nodes(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_nodes_order_index ON nodes(workflow_id, order_index);

            -- 性能优化索引：设定库表
            CREATE INDEX IF NOT EXISTS idx_settings_project_id ON settings(project_id);
            CREATE INDEX IF NOT EXISTS idx_settings_project_category ON settings(project_id, category);
            CREATE INDEX IF NOT EXISTS idx_settings_name ON settings(name);

            -- 性能优化索引：设定提示词表
            CREATE INDEX IF NOT EXISTS idx_setting_prompts_project_id ON setting_prompts(project_id);
            CREATE INDEX IF NOT EXISTS idx_setting_prompts_project_category ON setting_prompts(project_id, category);

            -- 性能优化索引：执行记录表
            CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_executions_workflow_started ON executions(workflow_id, started_at DESC);

            -- 性能优化索引：节点结果表
            CREATE INDEX IF NOT EXISTS idx_node_results_execution_id ON node_results(execution_id);
            CREATE INDEX IF NOT EXISTS idx_node_results_node_id ON node_results(node_id);
            CREATE INDEX IF NOT EXISTS idx_node_results_started_at ON node_results(started_at);

            -- 性能优化索引：工作流版本历史表
            CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_versions_number ON workflow_versions(workflow_id, version_number DESC);
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add_settings_hierarchy",
        sql: r#"
            ALTER TABLE settings ADD COLUMN parent_id TEXT DEFAULT NULL;
            ALTER TABLE settings ADD COLUMN order_index INTEGER DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_settings_parent_id ON settings(parent_id);
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "add_token_usage_to_node_results",
        sql: r#"
            ALTER TABLE node_results ADD COLUMN token_usage TEXT;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "add_settings_injection_fields",
        sql: r#"
            ALTER TABLE settings ADD COLUMN injection_mode TEXT DEFAULT 'manual';
            ALTER TABLE settings ADD COLUMN priority TEXT DEFAULT 'medium';
            ALTER TABLE settings ADD COLUMN keywords TEXT DEFAULT NULL;
            ALTER TABLE settings ADD COLUMN summary TEXT DEFAULT NULL;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "add_setting_relations_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS setting_relations (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                label TEXT DEFAULT NULL,
                description TEXT DEFAULT NULL,
                bidirectional INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (source_id) REFERENCES settings(id) ON DELETE CASCADE,
                FOREIGN KEY (target_id) REFERENCES settings(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_relations_source ON setting_relations(source_id);
            CREATE INDEX IF NOT EXISTS idx_relations_target ON setting_relations(target_id);
            CREATE INDEX IF NOT EXISTS idx_relations_project ON setting_relations(project_id);
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 6,
        description: "add_setting_assistant_config",
        sql: r#"
            ALTER TABLE global_config ADD COLUMN setting_assistant TEXT DEFAULT NULL;
        "#,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            Builder::default()
                .add_migrations("sqlite:chouann_novel.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
