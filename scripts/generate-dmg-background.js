/**
 * 生成 macOS DMG 背景图片
 * 包含安装说明：提示用户未签名应用的处理方式
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DMG 窗口尺寸
const WIDTH = 660;
const HEIGHT = 500;

// 创建画布
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 绘制渐变背景
const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
gradient.addColorStop(0, '#1a1a2e');
gradient.addColorStop(1, '#16213e');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// 绘制装饰性圆形
ctx.beginPath();
ctx.arc(WIDTH * 0.8, HEIGHT * 0.2, 150, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(79, 172, 254, 0.08)';
ctx.fill();

ctx.beginPath();
ctx.arc(WIDTH * 0.2, HEIGHT * 0.8, 100, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(147, 112, 219, 0.08)';
ctx.fill();

// 绘制箭头指示（从 App 到 Applications 文件夹）
const arrowY = 170;
const arrowStartX = 240;
const arrowEndX = 420;

ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
ctx.lineWidth = 3;
ctx.setLineDash([10, 8]);

ctx.beginPath();
ctx.moveTo(arrowStartX, arrowY);
ctx.lineTo(arrowEndX, arrowY);
ctx.stroke();

// 箭头头部
ctx.setLineDash([]);
ctx.beginPath();
ctx.moveTo(arrowEndX - 15, arrowY - 10);
ctx.lineTo(arrowEndX, arrowY);
ctx.lineTo(arrowEndX - 15, arrowY + 10);
ctx.stroke();

// 顶部标题
ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ctx.fillStyle = '#ffffff';
ctx.textAlign = 'center';
ctx.fillText('将应用拖入 Applications 文件夹完成安装', WIDTH / 2, 60);

// 分隔线
ctx.beginPath();
ctx.moveTo(80, 280);
ctx.lineTo(WIDTH - 80, 280);
ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
ctx.lineWidth = 1;
ctx.stroke();

// 未签名应用说明标题
ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ctx.fillStyle = '#f59e0b';
ctx.textAlign = 'center';
ctx.fillText('⚠️ 首次运行未签名应用', WIDTH / 2, 320);

// 说明文字
ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

const instructions = [
  '如果提示"无法打开应用"，请执行以下步骤：',
  '',
  '1. 打开"系统偏好设置" → "安全性与隐私"',
  '2. 点击"仍要打开"按钮',
  '',
  '或在终端执行：',
];

let y = 350;
instructions.forEach(line => {
  ctx.fillText(line, WIDTH / 2, y);
  y += 22;
});

// 终端命令（等宽字体，带背景）
const command = 'sudo xattr -rd com.apple.quarantine /Applications/chouannnovel.app';
const commandY = y + 5;

// 命令背景
ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
const commandWidth = 520;
const commandHeight = 28;
const commandX = (WIDTH - commandWidth) / 2;
ctx.roundRect(commandX, commandY - 18, commandWidth, commandHeight, 6);
ctx.fill();

// 命令文字
ctx.font = '12px "SF Mono", "Monaco", "Inconsolata", "Fira Mono", monospace';
ctx.fillStyle = '#4ade80';
ctx.fillText(command, WIDTH / 2, commandY);

// 保存图片
const buffer = canvas.toBuffer('image/png');
const outputPath = path.join(__dirname, '..', 'src-tauri', 'dmg-background.png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ DMG 背景图片已生成: ${outputPath}`);
console.log(`   尺寸: ${WIDTH}x${HEIGHT}`);

