import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Kanban, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  X,
  Tag,
  Zap,
  Filter
} from 'lucide-react';
import { TaskItem, TaskStatus, Priority } from '../types';
import { generateSmartTaskBreakdown, createTaskApi, deleteTaskApi } from '../services/api';

interface TaskManagementPageProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
}

export const TaskManagementPage: React.FC<TaskManagementPageProps> = ({
  tasks,
  setTasks,
}) => {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiGoalInput, setAiGoalInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // New Manual Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('High');
  const [taskCategory, setTaskCategory] = useState('Development');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');

  const columns: { id: TaskStatus; title: string; color: string; bg: string }[] = [
    { id: 'todo', title: 'To Do', color: 'text-amber-400 border-amber-500/40', bg: 'bg-amber-500/10' },
    { id: 'in-progress', title: 'In Progress', color: 'text-cyan-400 border-cyan-500/40', bg: 'bg-cyan-500/10' },
    { id: 'completed', title: 'Completed', color: 'text-emerald-400 border-emerald-500/40', bg: 'bg-emerald-500/10' },
  ];

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;

    const createdTask = await createTaskApi(taskTitle, taskDesc, taskPriority);
    if (createdTask) {
      setTasks(prev => [createdTask, ...prev]);
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        title: taskTitle,
        description: taskDesc || 'No details provided.',
        priority: taskPriority,
        category: taskCategory,
        dueDate: taskDueDate,
        status: taskStatus,
        progress: taskStatus === 'completed' ? 100 : taskStatus === 'in-progress' ? 50 : 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setTasks(prev => [newTask, ...prev]);
    }

    setShowTaskModal(false);
    resetForm();
  };

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('High');
    setTaskCategory('Development');
  };

  const handleMoveStatus = (taskId: string, targetStatus: TaskStatus) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          const newProgress = targetStatus === 'completed' ? 100 : targetStatus === 'in-progress' ? 50 : 0;
          return { ...t, status: targetStatus, progress: newProgress };
        }
        return t;
      })
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Delete this task card?')) {
      await deleteTaskApi(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  // AI Goal Breakdown
  const handleGenerateAiTasks = async () => {
    if (!aiGoalInput.trim()) return;
    setIsGeneratingAi(true);

    try {
      const generated = await generateSmartTaskBreakdown(aiGoalInput);
      const formatted: TaskItem[] = generated.map((g, idx) => ({
        id: `ai-task-${Date.now()}-${idx}`,
        title: g.title || `Task: ${aiGoalInput}`,
        description: g.description || 'AI Generated sub-task.',
        priority: (g.priority as Priority) || 'High',
        category: g.category || 'Development',
        dueDate: g.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        status: (g.status as TaskStatus) || 'todo',
        progress: g.status === 'completed' ? 100 : g.status === 'in-progress' ? 50 : 0,
        createdAt: new Date().toISOString().split('T')[0],
      }));

      setTasks(prev => [...formatted, ...prev]);
      setShowAiModal(false);
      setAiGoalInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Kanban className="w-6 h-6 text-cyan-400" />
            <span>Kanban Task Workspace</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage high-velocity project deliverables with AI goal breakdown
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span>AI Goal Breakdown</span>
          </button>

          <button
            onClick={() => setShowTaskModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map(col => {
          const columnTasks = tasks.filter(t => t.status === col.id);

          return (
            <div
              key={col.id}
              className="p-4 rounded-3xl bg-slate-950/70 border border-white/10 flex flex-col space-y-4 min-h-[500px]"
            >
              {/* Column Title */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${col.bg} border ${col.color}`} />
                  <h3 className="text-sm font-bold text-white">{col.title}</h3>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Tasks */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {columnTasks.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-xs text-slate-500">
                    No tasks in {col.title}
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-cyan-500/40 shadow-lg space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                          {task.category}
                        </span>

                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          task.priority === 'High' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                          task.priority === 'Medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {task.priority} Priority
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>Progress</span>
                          <span className="font-mono text-cyan-400 font-bold">{task.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Actions & Move Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{task.dueDate}</span>
                        </span>

                        <div className="flex items-center space-x-1">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => handleMoveStatus(task.id, col.id === 'completed' ? 'in-progress' : 'todo')}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Move Left"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}

                          {col.id !== 'completed' && (
                            <button
                              onClick={() => handleMoveStatus(task.id, col.id === 'todo' ? 'in-progress' : 'completed')}
                              className="p-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300"
                              title="Move Right"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Create Kanban Task</h3>
                <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Task Title</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="E.g., Implement Gemini API authentication proxy"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={taskDesc}
                    onChange={e => setTaskDesc(e.target.value)}
                    placeholder="Task details and expectations..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value as Priority)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={taskCategory}
                      onChange={e => setTaskCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operations">Operations</option>
                      <option value="Research">Research</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Status Column</label>
                    <select
                      value={taskStatus}
                      onChange={e => setTaskStatus(e.target.value as TaskStatus)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
                >
                  Create Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Task Generator Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-purple-500/30 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">AI Goal Task Breakdown</h3>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-300">
                  Enter a high-level project goal and Gemini AI will automatically generate broken-down Kanban tasks with priorities and categories.
                </p>

                <input
                  type="text"
                  value={aiGoalInput}
                  onChange={e => setAiGoalInput(e.target.value)}
                  placeholder="E.g., Launch Q3 SaaS Landing Page and API Dashboard"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAiTasks}
                  disabled={isGeneratingAi || !aiGoalInput.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center space-x-2 disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{isGeneratingAi ? 'Generating Tasks...' : 'Generate Kanban Cards'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
