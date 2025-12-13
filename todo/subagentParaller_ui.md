import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
Play,
Square,
MessageSquare,
Cpu,
Layers,
CheckCircle,
Clock,
XCircle,
X,
ChevronRight,
ChevronLeft,
Terminal,
Settings,
MoreHorizontal
} from 'lucide-react';

/\*\*

- ***
- 类型定义 (对应设计文档中的 Types)
- ***
    \*/

type AgentStatus = 'running' | 'completed' | 'queued' | 'failed';

interface SubagentInfo {
id: string;
name: string;
status: AgentStatus;
progress: number; // 0-100
model: string;
logs: LogMessage[];
result?: string;
}

interface LogMessage {
id: string;
sender: 'user' | 'system' | 'agent';
text: string;
type?: 'info' | 'code' | 'thinking';
timestamp: number;
}

/\*\*

- ***
- 辅助函数
- ***
    \*/
    // 使用模块级计数器确保绝对唯一，避免高频更新时的碰撞
    let uniqueIdCounter = 0;
    const generateId = () => `log-${Date.now()}-${uniqueIdCounter++}`;

/\*\*

- ***
- 模拟后端逻辑: ParallelSubagentManager & Context
- ***
    \*/

const MAX_CONCURRENCY = 2; // 为了演示排队效果，将并发设为2
const AUTO_CLOSE_DELAY = 3000;

// 模拟任务数据
const SIMULATION_TASKS = [
{ id: 'agent-1', name: 'ContextAnalyzer', model: 'claude-3-haiku', duration: 4000 },
{ id: 'agent-2', name: 'SecurityScanner', model: 'claude-3-sonnet', duration: 7000 },
{ id: 'agent-3', name: 'TestGenerator', model: 'claude-3-opus', duration: 6000 },
{ id: 'agent-4', name: 'DocUpdater', model: 'claude-3-haiku', duration: 3000 },
{ id: 'agent-5', name: 'Reviewer', model: 'claude-3-sonnet', duration: 5000 },
];

/\*\*

- ***
- UI 组件: SubagentTabBar (核心实现)
- 对应文档 8.2.2 章节
- ***
    \*/

const SubagentTabBar = ({
subagents,
activeTabId,
onTabChange,
onTabClose
}: {
subagents: SubagentInfo[],
activeTabId: string,
onTabChange: (id: string) => void,
onTabClose: (id: string) => void
}) => {
const scrollContainerRef = useRef<HTMLDivElement>(null);
const [canScrollLeft, setCanScrollLeft] = useState(false);
const [canScrollRight, setCanScrollRight] = useState(false);

// 计算队列数量
const runningCount = subagents.filter(a => a.status === 'running').length;
const queuedCount = subagents.filter(a => a.status === 'queued').length;

// 检查滚动状态
const checkScroll = useCallback(() => {
const el = scrollContainerRef.current;
if (el) {
const { scrollLeft, scrollWidth, clientWidth } = el;
// 使用 1px 的容差
setCanScrollLeft(scrollLeft > 0);
setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
}
}, [subagents]); // 当 tabs 变化时也需要检查

useEffect(() => {
checkScroll();
window.addEventListener('resize', checkScroll);
return () => window.removeEventListener('resize', checkScroll);
}, [checkScroll]);

// 平滑滚动
const scroll = (direction: 'left' | 'right') => {
const el = scrollContainerRef.current;
if (el) {
const scrollAmount = 200; // 每次滚动的像素距离
el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
}
};

return (
<div className="relative flex items-center bg-[#252526] border-b border-[#3e3e42] h-[36px] w-full group/tabbar">

      {/* Left Scroll Button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-20 px-1 bg-[#252526]/95 shadow-[2px_0_5px_rgba(0,0,0,0.3)] hover:bg-[#3e3e42] text-[#cccccc] flex items-center justify-center transition-colors border-r border-[#3e3e42]/50"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Scrollable Container (Hide Scrollbar) */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex items-center gap-1 px-3 h-full overflow-x-auto select-none w-full"
        style={{
          scrollbarWidth: 'none',  // Firefox
          msOverflowStyle: 'none',  // IE 10+
        }}
      >
        <style>{`
          /* Hide scrollbar for Chrome, Safari and Opera */
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Main Task Tab */}
        <SubagentTab
          id="main"
          name="Main Task"
          status="running"
          isActive={activeTabId === 'main'}
          isMain={true}
          onClick={() => onTabChange('main')}
        />

        {/* Separator */}
        {subagents.length > 0 && <div className="w-[1px] h-4 bg-[#3e3e42] mx-1 shrink-0" />}

        {/* Subagent Tabs */}
        {subagents.map((agent) => (
          <SubagentTab
            key={agent.id}
            id={agent.id}
            name={agent.name}
            status={agent.status}
            progress={agent.progress}
            model={agent.model}
            isActive={activeTabId === agent.id}
            onClick={() => onTabChange(agent.id)}
            onClose={() => onTabClose(agent.id)}
          />
        ))}

        {/* Queue Indicator - keep at end */}
        {queuedCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 ml-auto text-xs text-[#858585] animate-pulse whitespace-nowrap">
            <span className="font-mono font-bold">+{queuedCount}</span>
            <span>in Queue</span>
          </div>
        )}
      </div>

      {/* Right Scroll Button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 px-1 bg-[#252526]/95 shadow-[-2px_0_5px_rgba(0,0,0,0.3)] hover:bg-[#3e3e42] text-[#cccccc] flex items-center justify-center transition-colors border-l border-[#3e3e42]/50"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>

);
};

/\*\*

- UI 组件: 单个 Tab
- 对应文档 8.2.3 章节
  \*/
  const SubagentTab = ({
  id,
  name,
  status,
  progress = 0,
  model,
  isActive,
  isMain = false,
  onClick,
  onClose
  }: {
  id: string,
  name: string,
  status: AgentStatus,
  progress?: number,
  model?: string,
  isActive: boolean,
  isMain?: boolean,
  onClick: () => void,
  onClose?: () => void
  }) => {
  const [isClosing, setIsClosing] = useState(false);

// Status Icons
const getIcon = () => {
switch (status) {
case 'running': return <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent" />;
case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
case 'queued': return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
default: return null;
}
};

// 模拟自动关闭的淡出效果逻辑
useEffect(() => {
if (status === 'completed' && !isMain && !isActive) {
const timer = setTimeout(() => setIsClosing(true), AUTO_CLOSE_DELAY);
const removeTimer = setTimeout(() => {
if (onClose) onClose();
}, AUTO_CLOSE_DELAY + 300); // Wait for animation

      return () => { clearTimeout(timer); clearTimeout(removeTimer); };
    }

}, [status, isMain, isActive, onClose]);

return (
<div
onClick={onClick}
className={`         relative group flex items-center gap-2 px-3 py-1.5 rounded-t-sm cursor-pointer text-xs transition-all duration-200 min-w-[140px] max-w-[180px] border border-transparent flex-shrink-0
        ${isActive ? 'bg-[#1e1e1e] border-t-blue-500 border-x-[#3e3e42]' : 'bg-[#2d2d2d] hover:bg-[#2a2d2e] text-[#969696]'}
        ${isClosing ? 'opacity-0 -translate-y-2 scale-95 pointer-events-none' : 'opacity-100'}
        ${isMain ? 'font-semibold min-w-[100px]' : ''}
      `}
style={{
        borderBottom: isActive ? '1px solid #1e1e1e' : '1px solid transparent',
        marginBottom: '-1px',
        zIndex: isActive ? 10 : 1
      }} >
<div className="shrink-0 flex items-center justify-center w-4">
{getIcon()}
</div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between w-full">
          <span className="truncate">{name}</span>
          {!isMain && (
             <button
               onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
               className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#454545] rounded transition-opacity"
             >
               <X size={10} />
             </button>
          )}
        </div>

        {/* Progress Bar (Only for running) */}
        {status === 'running' && !isMain && (
          <div className="w-full h-[2px] bg-[#333] mt-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Model Badge (Optional) */}
        {status !== 'running' && model && !isMain && (
          <span className="text-[9px] opacity-60 leading-none mt-0.5">{model}</span>
        )}
      </div>
    </div>

);
};

/\*\*

- ***
- 主应用组件
- ***
    \*/

export default function RooCodeSimulator() {
const [activeTabId, setActiveTabId] = useState('main');
const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
const [mainLogs, setMainLogs] = useState<LogMessage[]>([
{ id: 'init-main', sender: 'system', text: 'Roo Code initialized. Ready for parallel execution.', timestamp: Date.now(), type: 'info' }
]);
const [input, setInput] = useState('');
const logsEndRef = useRef<HTMLDivElement>(null);

// 滚动到底部
useEffect(() => {
logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [mainLogs, subagents, activeTabId]);

// ----------------------------------------------------------------
// 模拟调度器逻辑 (Simplified Scheduler)
// ----------------------------------------------------------------
useEffect(() => {
const interval = setInterval(() => {
setSubagents(currentAgents => {
let runningCount = currentAgents.filter(a => a.status === 'running').length;

        return currentAgents.map(agent => {
          // 1. Handle Queued -> Running
          if (agent.status === 'queued') {
            if (runningCount < MAX_CONCURRENCY) {
              runningCount++;
              return {
                ...agent,
                status: 'running',
                logs: [...agent.logs, {
                  id: generateId(),
                  sender: 'system',
                  text: `Starting execution on ${agent.model}...`,
                  timestamp: Date.now(),
                  type: 'info'
                }]
              };
            }
            return agent;
          }

          // 2. Handle Running Progress
          if (agent.status === 'running') {
            const newProgress = Math.min(agent.progress + (100 / (agent.result ? 10 : 40)), 100); // 模拟进度

            // 随机添加日志
            let newLogs = [...agent.logs];
            if (Math.random() > 0.85) {
               const thoughts = [
                 "Analyzing context...", "Extracting dependencies...", "Running static analysis...", "Generating unit tests...", "Validating security tokens...", "Optimizing query..."
               ];
               newLogs.push({
                 id: generateId(),
                 sender: 'agent',
                 text: thoughts[Math.floor(Math.random() * thoughts.length)],
                 timestamp: Date.now(),
                 type: 'thinking'
               });
            }

            // 完成逻辑
            if (newProgress >= 100) {
              // 完成时通知主任务
              setMainLogs(prev => [...prev, {
                id: generateId(),
                sender: 'system',
                text: `✅ Subagent [${agent.name}] completed task.`,
                timestamp: Date.now(),
                type: 'info'
              }]);

              return {
                ...agent,
                progress: 100,
                status: 'completed',
                logs: [...newLogs, { id: generateId(), sender: 'system', text: 'Task completed successfully.', timestamp: Date.now(), type: 'info' }]
              };
            }
            return { ...agent, progress: newProgress, logs: newLogs };
          }

          return agent;
        });
      });
    }, 100);

    return () => clearInterval(interval);

}, []);

// ----------------------------------------------------------------
// 交互处理器
// ----------------------------------------------------------------

const startSimulation = () => {
// 1. Add user message
setMainLogs(prev => [...prev, {
id: generateId(),
sender: 'user',
text: "Analyze the current project structure, check for security vulnerabilities, and generate missing tests.",
timestamp: Date.now()
}]);

    // 2. Add system thinking
    setTimeout(() => {
      setMainLogs(prev => [...prev, {
        id: generateId(),
        sender: 'system',
        text: "Breaking down request into parallel sub-tasks...",
        timestamp: Date.now(),
        type: 'thinking'
      }]);
    }, 800);

    // 3. Spawn Agents (Simulate ParallelSubagentManager.runBatch)
    setTimeout(() => {
      const newAgents: SubagentInfo[] = SIMULATION_TASKS.map(task => ({
        ...task,
        status: 'queued',
        progress: 0,
        logs: [
          { id: generateId(), sender: 'system', text: `Context initialized with 200k token limit.`, timestamp: Date.now(), type: 'info' },
          { id: generateId(), sender: 'system', text: `Assigned Model: ${task.model}`, timestamp: Date.now(), type: 'info' }
        ]
      }));
      setSubagents(newAgents);
    }, 1500);

};

const handleSendMessage = () => {
if (!input.trim()) return;

    if (activeTabId === 'main') {
      setMainLogs(prev => [...prev, { id: generateId(), sender: 'user', text: input, timestamp: Date.now() }]);
      if (input.toLowerCase().includes("start")) {
        startSimulation();
      }
    } else {
      // Chatting with specific subagent
      setSubagents(prev => prev.map(a => {
        if (a.id === activeTabId) {
          return {
            ...a,
            logs: [...a.logs, { id: generateId(), sender: 'user', text: input, timestamp: Date.now() }]
          };
        }
        return a;
      }));
    }
    setInput('');

};

const closeTab = (id: string) => {
setSubagents(prev => prev.filter(a => a.id !== id));
if (activeTabId === id) setActiveTabId('main');
};

// 获取当前视图的日志
const currentLogs = activeTabId === 'main'
? mainLogs
: subagents.find(a => a.id === activeTabId)?.logs || [];

const currentAgent = subagents.find(a => a.id === activeTabId);

return (
<div className="flex h-screen w-full bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden">

      {/* 1. 左侧 Activity Bar (Visual Only) */}
      <div className="w-[48px] bg-[#333333] flex flex-col items-center py-4 gap-6 shrink-0 z-20">
        <FilesIcon active={false} />
        <SearchIcon active={false} />
        <GitIcon active={false} />
        <RooIcon active={true} />
        <div className="mt-auto flex flex-col items-center gap-6 pb-2">
           <Settings size={24} className="text-[#858585] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* 2. Primary Side Bar (Roo Code Panel) */}
      <div className="w-full flex flex-col bg-[#1e1e1e] border-r border-[#3e3e42] max-w-2xl mx-auto shadow-2xl">

        {/* Header */}
        <div className="h-[35px] flex items-center px-4 bg-[#252526] text-[11px] font-semibold text-[#cccccc] uppercase tracking-wide border-b border-[#3e3e42] justify-between">
          <div className="flex items-center gap-2">
             <span>ROO CODE (PREVIEW)</span>
             <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 text-[9px]">v2.0 Parallel</span>
          </div>
          <MoreHorizontal size={14} className="cursor-pointer hover:text-white" />
        </div>

        {/* Task Stats Header */}
        <div className="p-4 border-b border-[#3e3e42] bg-[#1e1e1e]">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare size={14} className="text-blue-400" />
              Implement Parallel Architecture
            </h2>
            <span className="text-xs text-[#858585]">Cost: $0.14</span>
          </div>
          <div className="flex gap-4 text-[10px] text-[#858585]">
            <div className="flex items-center gap-1">
              <Cpu size={10} /> <span>Tokens: 4.2k / 1.1k</span>
            </div>
            <div className="flex items-center gap-1">
              <Layers size={10} /> <span>Context: 12%</span>
            </div>
            <div className="flex items-center gap-1 text-green-500">
               <span>Workers: {subagents.filter(a => a.status === 'running').length}/{MAX_CONCURRENCY}</span>
            </div>
          </div>
        </div>

        {/* --- [CORE FEATURE] Subagent Tab Bar --- */}
        <SubagentTabBar
          subagents={subagents}
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          onTabClose={closeTab}
        />

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1e1e1e] custom-scrollbar relative">

          {/* Context Banner (If viewing subagent) */}
          {activeTabId !== 'main' && currentAgent && (
             <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 bg-[#252526]/95 backdrop-blur-sm border-b border-blue-500/30 p-3 shadow-lg">
                <div className="flex justify-between items-center text-xs">
                   <div className="flex flex-col">
                      <span className="font-bold text-blue-400 flex items-center gap-1">
                        {currentAgent.status === 'running' ? <span className="animate-spin">⟳</span> : <Terminal size={12}/>}
                        {currentAgent.name} Context
                      </span>
                      <span className="opacity-60 font-mono text-[10px]">ID: {currentAgent.id} • {currentAgent.model}</span>
                   </div>
                   <div className="text-[10px] px-2 py-1 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                      Isolated Memory: 200k
                   </div>
                </div>
             </div>
          )}

          {/* Messages */}
          {currentLogs.length === 0 && activeTabId === 'main' ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#858585] opacity-50 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                 <RooIcon active={false} size={32} />
              </div>
              <p className="text-sm">Roo Code is ready.<br/>Try "Start Complex Task" below.</p>
            </div>
          ) : (
            currentLogs.map((log) => (
              <div key={log.id} className={`flex gap-3 text-sm ${log.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5
                  ${log.sender === 'user' ? 'bg-[#3e3e42]' : (log.sender === 'agent' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300')}
                `}>
                  {log.sender === 'user' ? 'U' : (log.sender === 'agent' ? 'A' : 'R')}
                </div>
                <div className={`flex flex-col max-w-[85%] ${log.sender === 'user' ? 'items-end' : 'items-start'}`}>
                   {log.type === 'thinking' && (
                      <span className="text-[10px] text-[#858585] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Cpu size={10} /> Thinking
                      </span>
                   )}
                   <div className={`px-3 py-2 rounded-lg
                     ${log.sender === 'user' ? 'bg-[#264f78] text-white' : 'bg-[#252526] border border-[#3e3e42]'}
                     ${log.type === 'thinking' ? 'italic text-[#9cdcfe]' : ''}
                   `}>
                     {log.text}
                   </div>
                   <span className="text-[10px] text-[#5a5a5a] mt-1">
                     {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                   </span>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#3e3e42] bg-[#1e1e1e]">
          {activeTabId === 'main' && subagents.length === 0 && (
             <div className="mb-3">
               <button
                 onClick={startSimulation}
                 className="flex items-center gap-2 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white px-3 py-1.5 rounded transition-colors"
               >
                 <Play size={12} fill="currentColor" /> Start Demo Task (Simulate Parallel Agents)
               </button>
             </div>
          )}

          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={activeTabId === 'main' ? "Ask Roo to spawn sub-agents..." : `Send message to ${currentAgent?.name}...`}
              className="w-full bg-[#3c3c3c] text-[#cccccc] text-sm p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-[#007fd4] resize-none h-[80px]"
            />
            <button
              onClick={handleSendMessage}
              className="absolute bottom-2 right-2 p-1.5 bg-[#0e639c] text-white rounded hover:bg-[#1177bb] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 text-[10px] text-[#858585]">
             <span>Context: {activeTabId === 'main' ? 'Global' : 'Isolated'}</span>
             <span>Parallel Mode: Auto (Max 10)</span>
          </div>
        </div>

      </div>

      {/* Editor Placeholder (Right Side) */}
      <div className="flex-1 bg-[#1e1e1e] flex flex-col items-center justify-center text-[#3e3e42] select-none border-l border-[#2b2b2b]">
         <div className="w-64 h-64 border-2 border-dashed border-[#333] rounded-lg flex flex-col items-center justify-center gap-4">
            <span className="text-xl font-bold">VS Code Editor</span>
            <span className="text-sm text-center px-4">Files generated by Roo Code would appear here.</span>
         </div>
      </div>
    </div>

);
}

// --- Icons & Helpers ---

const RooIcon = ({active, size=24}: {active: boolean, size?: number}) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2L2 7L12 12L22 7L12 2Z" stroke={active ? "white" : "#858585"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M2 17L12 22L22 17" stroke={active ? "white" : "#858585"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M2 12L12 17L22 12" stroke={active ? "white" : "#858585"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
);

const FilesIcon = ({active}: {active: boolean}) => <Layers size={24} className={active ? "text-white" : "text-[#858585]"} />;
const SearchIcon = ({active}: {active: boolean}) => (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "#858585"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="11" cy="11" r="8"></circle>
<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
);
const GitIcon = ({active}: {active: boolean}) => (
<svg width="24" height="24" viewBox="0 24 24" fill="none" stroke={active ? "white" : "#858585"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="18" r="3"></circle>
<circle cx="6" cy="6" r="3"></circle>
<circle cx="18" cy="6" r="3"></circle>
<path d="M6 9v9"></path>
<path d="M18 9v9"></path>
<path d="M12 15V9"></path>
</svg>
);
