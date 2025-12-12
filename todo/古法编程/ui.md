import React, { useState, useEffect, useRef } from 'react';
import {
AlertCircle,
Terminal as TerminalIcon,
Award,
Clock,
Zap,
Users,
Settings,
Search,
FileCode,
GitBranch,
Menu,
X,
Minimize2,
Maximize2,
Square,
Play,
Lightbulb,
Bot,
CheckCircle2,
AlertTriangle,
ChevronRight,
ChevronDown,
FolderOpen,
MoreHorizontal,
Flame,
Cloud,
RefreshCw,
Check,
Sliders,
Shield,
BookOpen,
ArrowRight,
ArrowLeft,
Cpu
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Types ---

type ActivityBarItem = 'explorer' | 'search' | 'git' | 'ancient-way' | 'extensions' | 'settings';

// --- Mock Data & Helpers ---

const INITIAL_CODE = `import { processData } from './utils';

// 主程序入口: 执行核心业务逻辑
function main() {
console.log("启动古法编程环境...");

// [ERR-001] 变量 'a' 在使用前未定义
let result = a + 100;

console.log("计算结果:", result);

// [WRN-015] 未使用的变量
const temp = "debug_info";

processData(result);
}

main();`;

const TARGET_FIX_BLOCK = `  // [已修复] 变量 'a' 已声明
  let a = 50;
  let result = a + 100;`;

const FIXED_CODE_FULL = `import { processData } from './utils';

// 主程序入口: 执行核心业务逻辑
function main() {
console.log("启动古法编程环境...");

// [已修复] 变量 'a' 已声明
let a = 50;
let result = a + 100;

console.log("计算结果:", result);

processData(result);
}

main();`;

// Syntax Highlighting Helper
const highlightSyntax = (line: string) => {
const parts = line.split(/(\/\/._$|'._?'|".\*?"|\bfunction\b|\blet\b|\bconst\b|\bimport\b|\bfrom\b|\breturn\b|\bif\b|\belse\b|\bconsole\b)/g);
return parts.map((part, index) => {
if (part.startsWith('//')) return <span key={index} className="text-[#6a9955]">{part}</span>;
if (part.startsWith("'") || part.startsWith('"')) return <span key={index} className="text-[#ce9178]">{part}</span>;
if (['function', 'let', 'const', 'import', 'from', 'return', 'if', 'else'].includes(part)) return <span key={index} className="text-[#569cd6] font-bold">{part}</span>;
if (part === 'console') return <span key={index} className="text-[#4ec9b0]">{part}</span>;
return <span key={index} className="text-[#d4d4d4]">{part}</span>;
});
};

// --- Components ---

// 1. Sidebar Setup Wizard (New: Inside Plugin Panel)
const SidebarSetupWizard = ({ onComplete }: { onComplete: (config: any) => void }) => {
const [step, setStep] = useState(1);
const [formData, setFormData] = useState({ level: '', language: '', mode: '' });

return (
<div className="flex flex-col h-full bg-[#252526] text-gray-300 font-sans p-4 animate-in fade-in duration-300">
{/_ Header Area _/}
<div className="flex flex-col items-center mb-6 pt-4 space-y-3">
<div className="relative">
<div className="w-16 h-16 bg-[#3c1515] rounded-full flex items-center justify-center border border-red-500 text-3xl shadow-lg shadow-red-900/50 animate-pulse">
🏮
</div>
<div className="absolute -bottom-1 -right-1 bg-blue-500 text-[9px] text-white px-1.5 rounded-full border border-[#252526]">NEW</div>
</div>
<div className="text-center">
<h2 className="text-white font-bold text-lg">古法道场</h2>
<p className="text-xs text-gray-500">v2.0.4 · Initialization</p>
</div>
</div>

      {/* Steps Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
        {step === 1 && (
          <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
              选择修行阶段
            </div>
            <div className="space-y-2">
              {['炼气期 (新手)', '筑基期 (专业)', '金丹期 (专家)', '元婴期 (架构师)'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFormData({...formData, level: opt})}
                  className={`w-full p-3 text-left rounded-md text-xs border transition-all flex justify-between group ${formData.level === opt ? 'bg-red-900/40 border-red-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:bg-[#2d2d2d] hover:border-gray-500'}`}
                >
                  <span>{opt.split(' ')[0]}</span>
                  <span className={`text-[10px] ${formData.level === opt ? 'text-red-300' : 'text-gray-600'}`}>{opt.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
             <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">2</span>
              本命语言
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['TypeScript', 'Rust', 'Go', 'Python', 'C++', 'Java'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFormData({...formData, language: opt})}
                  className={`p-2 text-center rounded-md text-xs border transition-all ${formData.language === opt ? 'bg-blue-900/40 border-blue-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
             <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">3</span>
              修行模式
            </div>
            <div className="space-y-2">
              {[{t: '🧘 禅定模式', d: '无时间限制'}, {t: '🔥 渡劫模式', d: '高压倒计时'}].map(opt => (
                <button
                  key={opt.t}
                  onClick={() => setFormData({...formData, mode: opt.t})}
                  className={`w-full p-3 text-left rounded-md border transition-all ${formData.mode === opt.t ? 'bg-yellow-900/40 border-yellow-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:bg-[#2d2d2d]'}`}
                >
                  <div className="font-bold text-xs mb-1">{opt.t}</div>
                  <div className="text-[10px] opacity-70">{opt.d}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="mt-4 pt-4 border-t border-[#333] flex justify-between items-center">
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)} className="p-2 hover:bg-[#333] rounded text-gray-400">
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : <div className="w-8"></div>}

        <div className="flex gap-1">
          {[1,2,3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${step === i ? 'bg-white' : 'bg-[#444]'}`}></div>)}
        </div>

        <button
          disabled={step === 1 && !formData.level || step === 2 && !formData.language || step === 3 && !formData.mode}
          onClick={() => step < 3 ? setStep(s => s + 1) : onComplete(formData)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors"
        >
          {step === 3 ? '激活' : '下一步'} {step !== 3 && <ArrowRight className="w-3 h-3" />}
        </button>
      </div>
    </div>

);
};

// 1.5 Settings View Overlay
const SettingsView = ({ onClose }: { onClose: () => void }) => {
const [provider, setProvider] = useState('openai');

return (
<div className="absolute inset-0 bg-[#1e1e1e] z-50 flex flex-col animate-in fade-in zoom-in duration-200">
<div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#252526]">
<h2 className="text-white font-bold flex items-center gap-2">
<Settings className="w-5 h-5 text-gray-300" /> 古法编程设置
</h2>
<button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
<X className="w-5 h-5" />
</button>
</div>
<div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-8">

        {/* Diagnostic Settings */}
        <section className="space-y-4">
           <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> 诊断与评分 (Diagnostics)
           </h3>
           <div className="bg-[#252526] rounded border border-[#333] p-4 space-y-4">
              <div className="flex items-center justify-between">
                 <div>
                    <div className="text-gray-200 font-medium">错误严重度阈值</div>
                    <div className="text-xs text-gray-500">设定哪些级别的错误会触发“紧急问题”警报</div>
                 </div>
                 <select className="bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-2 py-1">
                    <option>Level 3 (标准)</option>
                    <option>Level 5 (严格)</option>
                 </select>
              </div>
              <div className="flex items-center justify-between">
                 <div>
                    <div className="text-gray-200 font-medium">终端错误监控</div>
                    <div className="text-xs text-gray-500">实时分析终端输出的编译错误</div>
                 </div>
                 <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                 </div>
              </div>
           </div>
        </section>

        {/* Incentives Settings */}
        <section className="space-y-4">
           <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" /> 时间与激励 (Incentives)
           </h3>
           <div className="bg-[#252526] rounded border border-[#333] p-4 space-y-4">
              <div className="flex items-center justify-between">
                 <div>
                    <div className="text-gray-200 font-medium">倒计时压力模式</div>
                    <div className="text-xs text-gray-500">“渡劫模式”将在超时后每分钟扣除 0.2 分</div>
                 </div>
                 <div className="flex gap-2">
                    {['宽松', '标准', '高压'].map(m => (
                       <button key={m} className={`px-3 py-1 text-xs rounded border ${m === '标准' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-100' : 'bg-[#1e1e1e] border-[#333] text-gray-500'}`}>{m}</button>
                    ))}
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <div>
                    <div className="text-gray-200 font-medium">心流连击特效</div>
                    <div className="text-xs text-gray-500">连续修复问题时显示火焰与屏幕震动特效</div>
                 </div>
                 <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                 </div>
              </div>
           </div>
        </section>

         {/* Hint Settings */}
         <section className="space-y-4">
           <h3 className="text-sm font-bold text-green-500 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> 提示与教学 (Pedagogy)
           </h3>
           <div className="bg-[#252526] rounded border border-[#333] p-4 space-y-4">
              <div className="flex items-center justify-between">
                 <div>
                    <div className="text-gray-200 font-medium">古法提示详细程度</div>
                    <div className="text-xs text-gray-500">不仅提供哲理，还展示底层原理和相似问题</div>
                 </div>
                 <select className="bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-2 py-1">
                    <option>完整 (哲理+分析+推荐)</option>
                    <option>极简 (仅哲理)</option>
                 </select>
              </div>
           </div>
        </section>

        {/* LLM Settings */}
        <section className="space-y-4">
           <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> LLM 模型配置 (LLM Configuration)
           </h3>
           <div className="bg-[#252526] rounded border border-[#333] p-4 space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                 <label className="text-xs text-gray-500 font-medium">模型提供商 (Provider)</label>
                 <select
                   value={provider}
                   onChange={(e) => setProvider(e.target.value)}
                   className="w-full bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-3 py-2 focus:border-purple-500 outline-none transition-colors"
                 >
                    <option value="openai">OpenAI (GPT-4/3.5)</option>
                    <option value="claude">Anthropic (Claude 3.5)</option>
                    <option value="gemini">Google (Gemini Pro)</option>
                    <option value="custom-openai">Custom (OpenAI Compatible)</option>
                    <option value="custom-claude">Custom (Claude Compatible)</option>
                 </select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                 <label className="text-xs text-gray-500 font-medium">API 密钥 (API Key)</label>
                 <div className="flex gap-2">
                    <input type="password" placeholder="sk-..." className="flex-1 bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-3 py-2 focus:border-purple-500 outline-none" />
                 </div>
              </div>

              {/* Custom Endpoint (Conditional visual) */}
              {(provider.includes('custom')) && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                   <label className="text-xs text-gray-500 font-medium">自定义端点 (Base URL)</label>
                   <input type="text" placeholder={provider.includes('openai') ? "https://api.example.com/v1" : "https://api.anthropic.com/v1"} className="w-full bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-3 py-2 focus:border-purple-500 outline-none" />
                </div>
              )}

              {/* Model Name */}
              <div className="space-y-2">
                 <label className="text-xs text-gray-500 font-medium">模型名称 (Model)</label>
                 <input type="text" placeholder="gpt-4-turbo" defaultValue={provider === 'claude' ? 'claude-3-5-sonnet-20240620' : 'gpt-4-turbo'} className="w-full bg-[#1e1e1e] border border-[#333] text-gray-300 text-sm rounded px-3 py-2 focus:border-purple-500 outline-none" />
              </div>

              {/* Test Connection */}
              <div className="pt-2 flex justify-end">
                 <button className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#333] text-xs text-gray-300 rounded flex items-center gap-2 transition-colors active:scale-95">
                    <Zap className="w-3 h-3 text-yellow-500" /> 测试连接
                 </button>
              </div>
           </div>
        </section>

      </div>
    </div>

);
};

// 2. Main Simulation
export default function VSCodeAncientWaySim() {
const [activeActivity, setActiveActivity] = useState<ActivityBarItem>('ancient-way');
const [showSettings, setShowSettings] = useState(false);

// Setup State
const [isSetupComplete, setIsSetupComplete] = useState(false);
const [userConfig, setUserConfig] = useState<any>(null);

const [codeContent, setCodeContent] = useState(INITIAL_CODE);
const [isFixed, setIsFixed] = useState(false);
const [isTyping, setIsTyping] = useState(false);
const [combo, setCombo] = useState(0);
const [terminalOutput, setTerminalOutput] = useState<string[]>([
"Microsoft Windows [Version 10.0.19045.2486]",
"(c) Microsoft Corporation. All rights reserved.",
"",
"C:\\Users\\Dev\\Project> npm start",
]);

// Extension State
const [score, setScore] = useState(87.5);
const [showHint, setShowHint] = useState(false);
const [issuesCount, setIssuesCount] = useState(1);

// Terminal Simulation Logic
useEffect(() => {
// Only simulate error if setup is complete
if (isSetupComplete && !isFixed && !isTyping) {
// If just finished setup, show startup logs first
if (terminalOutput.length < 5) {
const startupTimer = setTimeout(() => {
setTerminalOutput(prev => [
...prev,
"> ancient-project@1.0.0 start",
"> ts-node main.ts",
"",
"🚀 Starting Ancient Way Environment...",
]);
}, 500);

          const errorTimer = setTimeout(() => {
             setTerminalOutput(prev => [
                ...prev,
                "❌ Error: TSError: ⨯ Unable to compile TypeScript:",
                "main.ts(7,16): error TS2304: Cannot find name 'a'.",
                "",
                "🔴 编译失败 (exit code 1)"
             ]);
          }, 2000);

          return () => { clearTimeout(startupTimer); clearTimeout(errorTimer); };
       }
    }

}, [isSetupComplete, isFixed, isTyping]);

const handleSetupComplete = (config: any) => {
setUserConfig(config);
setIsSetupComplete(true);
// Auto switch to terminal to show it's "booting"
// But user might want to stay on ancient panel.
};

// Simulate "Handwriting" Typing Effect
const handleFixCode = () => {
if (isTyping) return;
setIsTyping(true);
let currentCode = codeContent;
const targetCode = FIXED_CODE_FULL;

    // Simulate finding the spot and deleting/typing
    let progress = 0;
    const typingInterval = setInterval(() => {
      progress += 1;

      // Visual feedback of "fixing"
      if (progress < 5) {
        // Deleting the bad line visually (simple slice for demo)
        const lines = currentCode.split('\n');
        lines[7] = "  let result = a + 100; // Fixing...";
        setCodeContent(lines.join('\n'));
      } else if (progress < 25) {
        // Typing out new lines char by char simulation (simplified block replace)
        const lines = currentCode.split('\n');
        const chars = TARGET_FIX_BLOCK.split('');
        const typedSoFar = chars.slice(0, Math.floor((progress - 5) * 2)).join('');

        // Split the new content into two lines logic
        if (typedSoFar.length < 30) {
           lines[7] = typedSoFar;
        } else {
           lines[7] = "  // [已修复] 变量 'a' 已声明";
           lines[8] = "  let a = 50;";
           lines[9] = "  let result = a + 100;"; // Shift down
        }
        if (progress === 24) setCodeContent(FIXED_CODE_FULL);
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        setIsFixed(true);
        setScore(score + 1.2);
        setCombo(c => c + 1);
        setIssuesCount(0);
        setTerminalOutput([
          "C:\\Users\\Dev\\Project> npm start",
          "> ancient-project@1.0.0 start",
          "> ts-node main.ts",
          "",
          "🚀 Starting Ancient Way Environment...",
          "✅ 启动成功",
          "计算结果: 150",
          "✨ Done in 1.2s"
        ]);
      }
    }, 50);

};

return (
<div className="flex h-screen w-full bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden select-none relative">
{showSettings && <SettingsView onClose={() => setShowSettings(false)} />}

      {/* Activity Bar */}
      <div className="w-12 bg-[#333333] flex flex-col items-center py-2 justify-between shrink-0 z-20">
        <div className="space-y-4">
          <ActivityBarIcon icon={FileCode} active={activeActivity === 'explorer'} onClick={() => setActiveActivity('explorer')} />
          <ActivityBarIcon icon={Search} active={activeActivity === 'search'} onClick={() => setActiveActivity('search')} />
          <ActivityBarIcon icon={GitBranch} active={activeActivity === 'git'} badge={1} onClick={() => setActiveActivity('git')} />

          {/* Ancient Way Icon with special styling */}
          <div className="relative group py-2">
            <button
              onClick={() => setActiveActivity('ancient-way')}
              className={`p-2 rounded-md transition-colors relative ${activeActivity === 'ancient-way' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg border shadow-lg ${activeActivity === 'ancient-way' ? 'bg-[#3c1515] border-red-500 text-red-200 shadow-red-900/50' : 'border-gray-700 bg-gray-800'}`}>
                🏮
              </div>
              {/* Only show issues badge if setup is complete */}
              {isSetupComplete && issuesCount > 0 && (
                <div className="absolute -top-0 -right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold shadow-sm">
                  {issuesCount}
                </div>
              )}
              {!isSetupComplete && (
                 <div className="absolute -top-0 -right-0 w-3 h-3 bg-blue-500 rounded-full animate-pulse border border-[#333]"></div>
              )}
            </button>
          </div>
          <ActivityBarIcon icon={Users} active={false} />
          <ActivityBarIcon icon={Bot} active={false} />
        </div>
        <div className="space-y-4 mb-2">
          <ActivityBarIcon
            icon={Settings}
            active={showSettings}
            onClick={() => setShowSettings(true)}
          />
        </div>
      </div>

      {/* Sidebar Panel */}
      <div className={`w-[340px] bg-[#252526] border-r border-[#1e1e1e] flex flex-col shrink-0 transition-all ${activeActivity ? 'translate-x-0' : '-translate-x-full absolute'}`}>
        <div className="h-9 px-4 flex items-center text-xs font-bold uppercase tracking-wider text-[#bbbbbb] bg-[#252526] border-b border-[#1e1e1e] justify-between">
          <span>{activeActivity === 'explorer' ? 'Explorer' : 'Ancient Way'}</span>
          <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-white" />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeActivity === 'explorer' && <FileExplorer />}
          {activeActivity === 'ancient-way' && (
            <>
               {!isSetupComplete ? (
                 <SidebarSetupWizard onComplete={handleSetupComplete} />
               ) : (
                 <AncientWayPanel
                   score={score}
                   issuesCount={issuesCount}
                   isFixed={isFixed}
                   showHint={showHint}
                   onToggleHint={() => setShowHint(!showHint)}
                   onFix={handleFixCode}
                   isTyping={isTyping}
                   combo={combo}
                   config={userConfig}
                 />
               )}
            </>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Editor Tabs */}
        <div className="h-9 bg-[#252526] flex items-center overflow-x-auto border-b border-[#1e1e1e]">
          <Tab name="main.ts" active={true} icon="ts" status={isSetupComplete && !isFixed ? 'error' : ''} modified={isSetupComplete && !isFixed} />
          <Tab name="utils.ts" active={false} icon="ts" />
          <Tab name="package.json" active={false} icon="json" />
        </div>

        {/* Breadcrumbs */}
        <div className="h-6 bg-[#1e1e1e] flex items-center px-4 text-xs text-gray-500 gap-1 shadow-sm">
          <span>ancient-project</span> <ChevronRight className="w-3 h-3" />
          <span>src</span> <ChevronRight className="w-3 h-3" />
          <span className="flex items-center gap-1 text-white"><div className="w-3 h-3 flex items-center justify-center text-blue-400 font-bold text-[8px]">TS</div> main.ts</span>
        </div>

        {/* Code Editor */}
        <div className="flex-1 relative font-mono text-[13px] overflow-hidden flex">
           {/* Gutter / Line Numbers */}
           <div className="w-14 bg-[#1e1e1e] text-[#858585] text-right pr-4 pt-2 select-none leading-6 relative">
             {codeContent.split('\n').map((_, i) => (
               <div key={i} className="relative">
                 {/* Git Modification Indicators */}
                 {isSetupComplete && i === 6 && !isFixed && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-blue-500 opacity-80"></div>}
                 {isSetupComplete && i === 7 && !isFixed && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-red-500 opacity-80"></div>}
                 {isFixed && (i >= 7 && i <= 8) && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-green-500 opacity-80"></div>}
                 {i + 1}
               </div>
             ))}
           </div>

           {/* Code Content */}
           <div className="flex-1 pl-4 pt-2 text-[#d4d4d4] whitespace-pre leading-6 overflow-auto relative">
             {/* Indent Guides */}
             <div className="absolute left-4 top-0 bottom-0 border-l border-[#404040] h-full pointer-events-none opacity-30 ml-[2ch]"></div>

             {codeContent.split('\n').map((line, i) => (
               <div key={i} className={`relative group ${isSetupComplete && i === 7 && !isFixed ? 'bg-red-900/10' : ''}`}>
                 {/* Syntax Highlighting */}
                 {highlightSyntax(line)}

                 {/* Error Squiggles (Only show after setup) */}
                 {isSetupComplete && !isFixed && line.includes('a + 100') && (
                   <div className="absolute left-[88px] bottom-0 w-24 h-[2px] bg-red-500 wave-underline"></div>
                 )}

                 {/* Typing Cursor Simulation */}
                 {isTyping && i === 7 && (
                   <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1 align-middle"></span>
                 )}
               </div>
             ))}

             {/* Hover Tooltip (Simulated) */}
             {isSetupComplete && !isFixed && !isTyping && (
               <div className="absolute top-[135px] left-[140px] bg-[#252526] border border-[#454545] p-3 rounded shadow-xl text-xs z-10 animate-in fade-in zoom-in duration-200 w-[300px]">
                 <div className="flex items-center gap-2 text-red-400 font-bold mb-1">
                   <AlertCircle className="w-3 h-3" /> 变量 'a' 未定义 (ERR-001)
                 </div>
                 <div className="text-gray-400 mb-2">Cannot find name 'a'. (ts-2304)</div>
                 <div className="text-gray-500 text-[10px] mb-2 font-mono bg-[#1e1e1e] p-1 rounded">let result = a + 100</div>
                 <div className="pt-2 border-t border-[#333] flex gap-2">
                   <button className="text-blue-400 hover:text-blue-300">Quick Fix...</button>
                   <span className="text-gray-600">|</span>
                   <button className="text-yellow-500 hover:text-yellow-400 font-bold">🏮 求助古法道场</button>
                 </div>
               </div>
             )}
           </div>

           {/* Minimap */}
           <div className="w-16 bg-[#1e1e1e] border-l border-[#2d2d2d] hidden md:block opacity-80 pt-2">
              <div className="space-y-1 px-1">
                 {codeContent.split('\n').map((line, i) => (
                    <div key={i} className={`h-1 rounded-full ${line.trim().length === 0 ? 'bg-transparent' : line.includes('ERR') && isSetupComplete ? 'bg-red-500' : 'bg-gray-600'} w-${Math.min(12, Math.ceil(line.length / 5))}/12`}></div>
                 ))}
              </div>
              <div className="h-16 bg-[#ffffff10] mt-2 relative"></div>
           </div>
        </div>

        {/* Terminal / Panel */}
        <div className="h-48 bg-[#1e1e1e] border-t border-[#2d2d2d] flex flex-col">
          <div className="flex items-center gap-6 px-4 py-2 text-xs uppercase font-bold text-gray-500 border-b border-[#2d2d2d]">
            <span className="text-white border-b border-white pb-1">Terminal</span>
            <span className="hover:text-white cursor-pointer">Output</span>
            <span className="hover:text-white cursor-pointer">Debug Console</span>
            <span className="hover:text-white cursor-pointer flex items-center gap-1">
              Problems
              <span className={`rounded-full px-1.5 text-[10px] ${!isFixed && isSetupComplete ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{!isFixed && isSetupComplete ? 1 : 0}</span>
            </span>
          </div>
          <div className="flex-1 p-3 font-mono text-xs overflow-y-auto text-[#cccccc]">
             {!isSetupComplete ? (
               <div className="text-gray-500 italic">Waiting for Ancient Way initialization...</div>
             ) : (
               terminalOutput.map((line, i) => (
                <div key={i} className={`mb-0.5 ${line.includes('Error') || line.includes('fail') ? 'text-red-400' : line.includes('✅') ? 'text-green-400' : ''}`}>
                  {line}
                </div>
               ))
             )}
            {isTyping && <div className="text-blue-400 animate-pulse">📝 Writing fixes to disk...</div>}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 w-full h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-xs z-30 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer"><GitBranch className="w-3 h-3" /> main*</div>
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer"><RefreshCw className="w-3 h-3" /></div>
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer"><AlertCircle className="w-3 h-3" /> {isFixed ? '0' : '1'} Errors</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer">Ln 7, Col 16</div>
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer">Spaces: 2</div>
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer">UTF-8</div>
          <div className="flex items-center gap-1 hover:bg-[#ffffff20] px-1 h-full cursor-pointer">TS 4.9</div>
          <div className="flex items-center gap-1 font-bold bg-[#c72e2e] px-3 h-6 hover:bg-[#a32222] cursor-pointer transition-colors" onClick={() => setActiveActivity('ancient-way')}>
            <span className="text-[10px]">🏮</span> {score.toFixed(1)}
          </div>
        </div>
      </div>
    </div>

);
}

// --- Sub-Components ---

const ActivityBarIcon = ({ icon: Icon, active, badge, onClick }: { icon: any, active: boolean, badge?: number, onClick?: () => void }) => (

  <div 
    onClick={onClick}
    className={`w-12 h-12 flex items-center justify-center cursor-pointer border-l-2 relative transition-colors ${active ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
  >
    <Icon className="w-6 h-6" />
    {badge && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>}
  </div>
);

const Tab = ({ name, active, icon, status, modified }: any) => (

  <div className={`flex items-center gap-2 px-3 h-full min-w-[120px] text-xs border-r border-[#1e1e1e] cursor-pointer group ${active ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2d2d2d]'}`}>
    <span className={`text-[10px] font-bold ${icon === 'ts' ? 'text-blue-400' : 'text-yellow-400'}`}>{icon.toUpperCase()}</span>
    <span>{name}</span>
    <span className={`text-[10px] ${status === 'error' ? 'text-red-500' : 'text-transparent'}`}>●</span>
    {modified && <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-50 ml-auto"></div>}
    {!modified && <X className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />}
  </div>
);

const FileExplorer = () => (

  <div className="p-0 text-sm text-gray-300 select-none">
    <div className="flex items-center gap-1 font-bold text-xs uppercase mb-2 px-4 py-2 hover:bg-[#2a2d2e] cursor-pointer">
       <ChevronDown className="w-3 h-3" /> Ancient-Project
    </div>
    <div className="space-y-0">
      <FileRow name="src" isFolder open />
      <div className="pl-4 border-l border-[#333] ml-3">
         <FileRow name="components" isFolder />
         <FileRow name="main.ts" icon="ts" active status="error" />
         <FileRow name="utils.ts" icon="ts" />
         <FileRow name="types.d.ts" icon="ts" />
      </div>
      <FileRow name=".gitignore" icon="git" />
      <FileRow name="package.json" icon="json" />
      <FileRow name="README.md" icon="txt" />
    </div>
  </div>
);

const FileRow = ({ name, isFolder, open, icon, active, status }: any) => (

  <div className={`flex items-center gap-1 px-4 py-1 cursor-pointer hover:bg-[#2a2d2e] ${active ? 'bg-[#37373d] text-white' : ''}`}>
    {isFolder ? <ChevronRight className={`w-4 h-4 text-gray-500 ${open ? 'rotate-90' : ''}`} /> : <div className="w-4"></div>}
    {isFolder ? <FolderOpen className="w-4 h-4 text-[#dcb67a]" /> : 
      <span className={`text-[10px] font-bold w-4 text-center ${icon === 'ts' ? 'text-blue-400' : icon === 'json' ? 'text-yellow-400' : 'text-gray-400'}`}>
        {icon ? icon.toUpperCase().slice(0,2) : ''}
      </span>
    }
    <span className={`${status === 'error' ? 'text-yellow-200' : ''}`}>{name}</span>
    {status === 'error' && <span className="text-red-500 ml-auto text-[10px]">1</span>}
  </div>
);

// --- The Core Extension UI (Enhanced) ---
const AncientWayPanel = ({ score, issuesCount, isFixed, showHint, onToggleHint, onFix, isTyping, combo, config }: any) => (

  <div className="flex flex-col h-full bg-[#252526] animate-in fade-in zoom-in duration-300">
    {/* Header with Visual Flair */}
    <div className="p-4 bg-gradient-to-b from-[#2d2d2d] to-[#252526] border-b border-[#333]">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-white font-bold flex items-center gap-2 text-sm">
             🏮 古法道场 
             <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[#3c1515] text-red-300 border border-red-900/50">
               {config?.level?.split(' ')[0] || '筑基期'}
             </span>
          </h2>
          <div className="flex items-center gap-2 mt-1">
             {combo > 0 && <div className="text-xs text-orange-400 flex items-center gap-1 font-bold animate-pulse"><Flame className="w-3 h-3" /> 心流连击 x{combo}</div>}
             {combo === 0 && <p className="text-[10px] text-gray-500">今日修为 +1.2</p>}
          </div>
        </div>
        <div className="text-right">
           <div className="text-2xl font-bold text-white tracking-tight">{score.toFixed(1)}</div>
           <div className="text-[10px] text-gray-500">道行评分</div>
        </div>
      </div>
      
      {/* Ability Radar (Simplified Visual) */}
      <div className="flex gap-1 h-1 w-full mt-2">
         <div className="flex-1 bg-red-500/50 rounded-l"></div>
         <div className="flex-1 bg-yellow-500/50"></div>
         <div className="flex-1 bg-blue-500/50"></div>
         <div className="flex-1 bg-green-500/50 rounded-r"></div>
      </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-3 space-y-4">

       {/* 1. Urgent Issues */}
       {!isFixed ? (
         <div className="space-y-3">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                 紧急问题 (Urgent)
              </h3>
              {/* Incense Timer Visual */}
              <div className="flex items-center gap-1 bg-[#1e1e1e] px-2 py-1 rounded border border-[#333]">
                <div className="w-1.5 h-6 bg-gray-700 rounded-full relative overflow-hidden">
                   <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-600 to-orange-400 h-[60%] animate-pulse"></div>
                   <div className="absolute top-[40%] left-0 right-0 h-1 bg-white opacity-50 blur-[1px]"></div>
                </div>
                <div className="flex flex-col text-[9px] text-gray-400 leading-none">
                   <span>焚香计时</span>
                   <span className="text-red-400 font-mono">01:42</span>
                </div>
              </div>
           </div>

           {/* Issue Card */}
           <div className="bg-[#1e1e1e] border-l-2 border-l-red-500 rounded-r shadow-lg relative group overflow-hidden transition-all hover:bg-[#2d2d2d]">
              <div className="p-3">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-2">
                     <AlertCircle className="w-4 h-4 text-red-500" />
                     <div className="text-sm font-bold text-gray-200">变量 'a' 未定义</div>
                   </div>
                   <span className="text-[9px] bg-[#333] px-1.5 py-0.5 rounded text-gray-400 border border-gray-600">难度: 3</span>
                </div>

                <div className="text-xs text-gray-500 font-mono pl-6 mb-3 flex items-center gap-2">
                   <span>main.ts:7:16</span>
                   <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                   <span>SyntaxError</span>
                </div>

                {/* Interactive Actions */}
                <div className="pl-6 space-y-2">
                   {/* Hint Section */}
                   {showHint ? (
                     <div className="bg-[#3c1515] border border-red-900/50 p-3 rounded text-xs text-red-200 animate-in fade-in slide-in-from-left-2 space-y-3">
                        {/* Level 1: Ancient Hint */}
                        <div>
                           <div className="flex items-center gap-2 mb-1 font-bold text-yellow-500">
                              <Lightbulb className="w-3 h-3" /> 古法哲理：
                           </div>
                           <p className="italic opacity-90 pl-5">"万物皆需有名。在JS世界中，未声明之物不可用。检查作用域或声明语句。"</p>
                        </div>

                        {/* Level 2: Technical Analysis */}
                        <div className="border-t border-red-900/30 pt-2">
                            <div className="flex items-center gap-2 mb-1 font-bold text-blue-400">
                               <Search className="w-3 h-3" /> 深度分析：
                            </div>
                            <ul className="list-disc list-inside opacity-80 pl-2 space-y-1">
                               <li>编译器无法在当前作用域找到变量 <code>a</code>。</li>
                               <li>可能原因：拼写错误、忘记定义、或定义在其他作用域（如函数内部）。</li>
                            </ul>
                        </div>

                        {/* Level 3: Related Patterns */}
                        <div className="bg-[#252526] p-2 rounded border border-[#333]">
                           <div className="flex items-center gap-2 mb-1 font-bold text-green-400 text-[10px] uppercase">
                              <Zap className="w-3 h-3" /> 触类旁通 (Related)
                           </div>
                           <div className="space-y-1">
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-[#333]">
                                 <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                 <span>ReferenceError: x is not defined</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-[#333]">
                                 <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>
                                 <span>Hoisting Issues (变量提升陷阱)</span>
                              </div>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <button
                       onClick={onToggleHint}
                       className="w-full text-left px-3 py-2 bg-[#2d2d2d] hover:bg-[#383838] rounded text-xs text-gray-300 flex items-center gap-2 transition-colors border border-[#333] group/hint"
                     >
                        <Lightbulb className="w-3 h-3 text-yellow-600 group-hover/hint:text-yellow-400" />
                        <span className="font-bold">感悟提示 (Hint)</span>
                     </button>
                   )}

                   {/* Fix Button with typing logic */}
                   <button
                     onClick={onFix}
                     disabled={isTyping}
                     className="w-full py-2 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-600 hover:to-green-700 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/30 border border-green-600/50 active:scale-[0.98]"
                   >
                      {isTyping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isTyping ? '正在手写修复...' : '手写修复 (+1.2分)'}
                   </button>

                   {/* AI Trap */}
                   <div className="flex justify-center pt-1">
                      <button className="text-[10px] text-gray-600 hover:text-red-400 flex items-center gap-1 transition-colors opacity-60 hover:opacity-100">
                         <Bot className="w-3 h-3" />
                         <span className="line-through decoration-red-500">AI 生成</span> (不推荐)
                      </button>
                   </div>
                </div>
              </div>
           </div>
         </div>
       ) : (
         /* Fixed State Success */
         <div className="bg-[#1e2e1e] border border-green-900/50 rounded-lg p-6 text-center animate-in zoom-in duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-green-500/5"></div>
            <div className="w-12 h-12 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-3 text-green-400 border border-green-700 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
               <Award className="w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-1 relative">问题已解决！</h3>
            <p className="text-xs text-gray-400 mb-3 relative">恭喜，您没有依赖 AI 独立解决了问题。</p>
            <div className="flex justify-center gap-2">
               <div className="inline-flex items-center gap-1 bg-[#1e1e1e] px-2 py-1 rounded text-green-400 text-xs font-mono font-bold border border-green-900">
                  <Zap className="w-3 h-3" /> +1.2 分
               </div>
               <div className="inline-flex items-center gap-1 bg-[#1e1e1e] px-2 py-1 rounded text-orange-400 text-xs font-mono font-bold border border-orange-900">
                  <Flame className="w-3 h-3" /> 连击 x{combo}
               </div>
            </div>
         </div>
       )}

       {/* 2. Warnings */}
       <div className="space-y-3 pt-2">
         <h3 className="text-xs font-bold text-gray-500 flex items-center gap-2 uppercase tracking-wider">
             建议 (Warnings)
         </h3>

         {[
           { code: 'WRN-015', msg: "Unused variable 'temp'", file: 'main.ts' },
           { code: 'IMP-002', msg: "Use const for immutable variables", file: 'utils.ts' }
         ].map((item, i) => (
           <div key={i} className="flex items-center gap-3 p-2 rounded bg-[#1e1e1e] border border-[#333] hover:bg-[#2a2d2e] hover:border-gray-600 transition-colors cursor-pointer group">
              <div className="w-1 h-full bg-yellow-600 rounded-full opacity-50 group-hover:opacity-100"></div>
              <div className="flex-1 overflow-hidden">
                 <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-0.5">
                    <span className="text-yellow-500">{item.code}</span>
                    <span>{item.file}</span>
                 </div>
                 <div className="text-xs text-gray-400 truncate group-hover:text-gray-200">{item.msg}</div>
              </div>
           </div>
         ))}
       </div>

       {/* 3. Team Stats */}
       <div className="mt-6 pt-6 border-t border-[#333]">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center justify-between">
             Team Ranking (Alpha)
             <MoreHorizontal className="w-3 h-3 cursor-pointer hover:text-white" />
          </h3>
          <div className="space-y-1">
             <TeamRow rank={1} name="@you" score={88.7} active diff={"+1.2"} />
             <TeamRow rank={2} name="@alex" score={85.2} diff={"+0.5"} />
             <TeamRow rank={3} name="@sarah" score={82.1} diff={"-0.2"} />
          </div>
       </div>
    </div>

  </div>
);

const TeamRow = ({ rank, name, score, active, diff }: any) => (

  <div className={`flex items-center justify-between p-2 rounded ${active ? 'bg-[#333] border-l-2 border-l-yellow-500' : 'hover:bg-[#2d2d2d] border-l-2 border-transparent'}`}>
     <div className="flex items-center gap-2">
        <span className={`text-[10px] w-4 h-4 flex items-center justify-center rounded ${rank === 1 ? 'text-yellow-500 font-bold' : 'text-gray-500'}`}>{rank}</span>
        <span className={`text-xs ${active ? 'text-white font-bold' : 'text-gray-400'}`}>{name}</span>
     </div>
     <div className="flex items-center gap-2">
        <span className={`text-[9px] ${diff.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{diff}</span>
        <div className="text-xs font-mono text-gray-500">{score}</div>
     </div>
  </div>
);
