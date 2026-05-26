import React from 'react';

// 🎨 方案 A：极速轨道 ── SpaceX 火箭喷射流线 TN 交叉轨道
export const BrandLogoA: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`filter drop-shadow-sm ${className}`}
    >
      <defs>
        <linearGradient id="spaceGradLogoA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* 字母 T 与 N 的极速流线交叉 */}
      {/* T 的横杠 (左侧带有 SpaceX 式的尖锐楔形斜切角，极具空气动力学视觉) */}
      <path d="M15 35H65L55 42H15V35Z" fill="url(#spaceGradLogoA)" />
      {/* T 的竖杠与 N 的左侧竖杠完美共用融合，立于中央，稳定硬朗 */}
      <path d="M42 35V75H49V35H42Z" fill="url(#spaceGradLogoA)" />
      {/* N 的斜跨喷射轨道：一笔极其亮眼、从交叉点如火箭轨道般冲出并带尖锐切角的白线条 */}
      <path d="M42 42L70 73H78L49 40V35L42 42Z" fill="#ffffff" />
      {/* N 的右侧竖笔：一笔利落的平行硬线 */}
      <path d="M70 42V75H77V42H70Z" fill="url(#spaceGradLogoA)" opacity="0.8" />
    </svg>
  );
};

// 🎨 方案 B：几何硬核 ── x.ai 极客切角与微缝隙拼接 TN (极致科幻)
export const BrandLogoB: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`filter drop-shadow-md ${className}`}
    >
      <defs>
        <linearGradient id="spaceGradLogoB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      {/* 极致冷硬的拼装积木切角 T & N (致敬 x.ai 的无衬线平直切角) */}
      {/* T 的横杠，带 45° 边缘切角 */}
      <path d="M20 30H60L55 37H20V30Z" fill="url(#spaceGradLogoB)" />
      {/* T 的竖杠也是 N 的左竖杠，底部带有 45° 锐利斜边 */}
      <path d="M36 37V70L43 63V37H36Z" fill="url(#spaceGradLogoB)" />
      {/* N 的斜梁：极其硬朗的 45° 粗切角斜线，与两侧立柱保持等宽极小科幻微缝隙 */}
      <path d="M46 37L70 61V70L46 46V37Z" fill="#6366f1" />
      {/* N 的右竖杠，顶部与底部均带有呼应的斜切面 */}
      <path d="M72 40V70H79V47L72 40Z" fill="url(#spaceGradLogoB)" />
    </svg>
  );
};

// 🎨 方案 C：双平科幻翼 ── 悬浮太空战机双翼 TN 组合
export const BrandLogoC: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`filter drop-shadow-md ${className}`}
    >
      <defs>
        <linearGradient id="spaceGradLogoC" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* 双平行太空飞船翼组合 T-N 变形 (带有强烈的流线型悬浮科幻感) */}
      {/* 左翼：硬朗构筑出字母 T 的姿态 */}
      <path d="M22 30H56L51 37H36V70H29V37H22V30Z" fill="url(#spaceGradLogoC)" />
      {/* 右翼：完美平行的 N 倾斜跨笔与右竖条的融合体，交错而立 */}
      <path d="M43 37L68 62V70L43 45V37Z" fill="#ffffff" />
      <path d="M68 45V70H75V37L68 45Z" fill="url(#spaceGradLogoC)" />
    </svg>
  );
};

// ==========================================
// 核心分发 Logo 组件 (BrandLogo)
// ==========================================
export const BrandLogo: React.FC<{ size?: number; className?: string; type?: 'A' | 'B' | 'C' }> = ({ size = 32, className = "", type = "B" }) => {
  if (type === 'A') return <BrandLogoA size={size} className={className} />;
  if (type === 'C') return <BrandLogoC size={size} className={className} />;
  return <BrandLogoB size={size} className={className} />;
};

// ==========================================
// 2. Alex 专属卡通头像组件 (男声，耳麦极客范)
// ==========================================
export const AlexAvatar: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`rounded-full overflow-hidden bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-slate-800 dark:to-blue-950 flex items-center justify-center p-0.5 border border-blue-200/50 dark:border-blue-800/30 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* 背景轻微发光圆 */}
        <circle cx="50" cy="50" r="48" fill="#e0f2fe" opacity="0.6" className="dark:hidden" />
        <circle cx="50" cy="50" r="48" fill="#1e293b" opacity="0.4" className="hidden dark:block" />

        {/* 卫衣肩膀 */}
        <path d="M15 90C15 78 28 70 50 70C72 70 85 78 85 90H15Z" fill="#312e81" />
        <path d="M38 70C38 78 44 82 50 82C56 82 62 78 62 70" fill="#4338ca" />

        {/* 脖子 */}
        <rect x="42" y="60" width="16" height="15" rx="3" fill="#fbcfe8" />
        <path d="M42 66C42 66 48 72 50 72C52 72 58 66 58 66" fill="#f472b6" opacity="0.3" />

        {/* 头部脸廓 */}
        <ellipse cx="50" cy="42" rx="20" ry="22" fill="#fed7aa" />

        {/* 发型 (极客短碎发) */}
        <path d="M28 35C28 24 38 18 50 18C62 18 72 24 72 35C72 37 68 35 64 36C60 37 57 32 50 32C43 32 40 37 36 36C32 35 28 37 28 35Z" fill="#1e1b4b" />
        {/* 碎发刘海路径 */}
        <path d="M30 32L34 38L38 34L42 39L47 33L52 38L57 33L62 38L66 33L70 36V28H30V32Z" fill="#1e1b4b" />

        {/* 眼睛 (自信友好) */}
        <circle cx="43" cy="42" r="2.5" fill="#1e293b" />
        <circle cx="57" cy="42" r="2.5" fill="#1e293b" />
        <path d="M41 38C42 37.5 44 37.5 45 38" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M55 38C56 37.5 58 37.5 59 38" stroke="#1e1b4b" strokeWidth="1.5" strokeLinecap="round" />

        {/* 腮红 */}
        <ellipse cx="36" cy="46" rx="2.5" ry="1.5" fill="#f43f5e" opacity="0.4" />
        <ellipse cx="64" cy="46" rx="2.5" ry="1.5" fill="#f43f5e" opacity="0.4" />

        {/* 鼻子 */}
        <path d="M49 44C49 44 50 46 51 46" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" />

        {/* 嘴巴 (微笑着倾听) */}
        <path d="M45 50C45 50 48 54 50 54C52 54 55 50 55 50" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" />

        {/* 头戴式降噪耳机 */}
        {/* 头梁 */}
        <path d="M28 36C28 20 72 20 72 36" fill="none" stroke="#475569" strokeWidth="4" />
        {/* 左耳罩 */}
        <rect x="25" y="32" width="8" height="18" rx="4" fill="#0f172a" />
        <rect x="23" y="34" width="2" height="14" rx="1" fill="#6366f1" />
        {/* 右耳罩 */}
        <rect x="67" y="32" width="8" height="18" rx="4" fill="#0f172a" />
        <rect x="75" y="34" width="2" height="14" rx="1" fill="#6366f1" />
      </svg>
    </div>
  );
};

// ==========================================
// 3. Jordan 专属卡通头像组件 (女声，知性眼镜耳麦)
// ==========================================
export const JordanAvatar: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`rounded-full overflow-hidden bg-gradient-to-tr from-emerald-100 to-teal-100 dark:from-slate-800 dark:to-emerald-950 flex items-center justify-center p-0.5 border border-emerald-200/50 dark:border-emerald-800/30 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* 背景轻微发光圆 */}
        <circle cx="50" cy="50" r="48" fill="#f0fdf4" opacity="0.6" className="dark:hidden" />
        <circle cx="50" cy="50" r="48" fill="#1e293b" opacity="0.4" className="hidden dark:block" />

        {/* 肩膀与针织衫 */}
        <path d="M15 90C15 78 28 72 50 72C72 72 85 78 85 90H15Z" fill="#065f46" />
        <path d="M42 72V90M58 72V90" stroke="#047857" strokeWidth="2" />
        <path d="M38 72C38 78 44 80 50 80C56 80 62 78 62 72" fill="#a7f3d0" />

        {/* 脖子 */}
        <rect x="43" y="60" width="14" height="15" fill="#fcd34d" opacity="0.6" />
        <path d="M43 65C43 65 48 70 50 70C52 70 57 65 57 65" fill="#eab308" opacity="0.3" />

        {/* 脸廓 */}
        <ellipse cx="50" cy="42" rx="19" ry="21" fill="#ffedd5" />

        {/* 栗色中长发 (后侧遮掩) */}
        <path d="M26 40V68C26 72 32 75 32 75M74 40V68C74 72 68 75 68 75" fill="none" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />

        {/* 金丝圆眼镜 (智慧与文艺) */}
        <circle cx="41" cy="42" r="7.5" fill="none" stroke="#d97706" strokeWidth="2" />
        <circle cx="59" cy="42" r="7.5" fill="none" stroke="#d97706" strokeWidth="2" />
        <line x1="48.5" y1="42" x2="51.5" y2="42" stroke="#d97706" strokeWidth="2" />
        <path d="M33.5 42H35M65 42h1.5" stroke="#d97706" strokeWidth="1.5" />

        {/* 眼睛 (透过镜片显示) */}
        <circle cx="41" cy="42" r="2" fill="#1e293b" />
        <circle cx="59" cy="42" r="2" fill="#1e293b" />

        {/* 弯弯的眉毛 */}
        <path d="M36 33C38 31.5 42 32 44 33.5" fill="none" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M56 33C58 31.5 62 32 64 33.5" fill="none" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />

        {/* 鼻子 */}
        <path d="M49.5 43C49.5 43 50 45 51 45" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />

        {/* 嘴巴 (红润开朗笑容) */}
        <path d="M45 50.5C46 54 54 54 55 50.5" fill="none" stroke="#be123c" strokeWidth="2.5" strokeLinecap="round" />

        {/* 栗色秀发 (顶部与刘海) */}
        <path d="M28 36C28 23 38 16 50 16C62 16 72 23 72 36C72 40 68 33 65 34C62 35 59 31 50 31C41 31 38 35 35 34C32 33 28 40 28 36Z" fill="#78350f" />
        {/* 斜刘海轮廓 */}
        <path d="M29 32C35 29 45 31 52 35C58 31 67 29 71 32" fill="none" stroke="#451a03" strokeWidth="1.5" />

        {/* 挂颈式白色无线耳机 */}
        {/* 挂颈硅胶弧线 */}
        <path d="M32 68C36 78 64 78 68 68" fill="none" stroke="#f1f5f9" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M32 68C36 78 64 78 68 68" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        {/* 左侧耳机块 */}
        <rect x="29" y="58" width="5" height="10" rx="2.5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" />
        {/* 右侧耳机块 */}
        <rect x="66" y="58" width="5" height="10" rx="2.5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" />
      </svg>
    </div>
  );
};
