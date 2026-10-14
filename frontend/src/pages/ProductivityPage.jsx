import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  apiGetTasks,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
} from '../services/api';

export default function ProductivityPage() {
  const { showError, showSuccess } = useToast();
  const [filter, setFilter] = useState('All');
  const [taskList, setTaskList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await apiGetTasks();
      const rawTasks = res?.data || [];
      const formatted = rawTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        category: t.priority ? t.priority.toUpperCase() : 'GENERAL',
        priority: t.priority
          ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1)
          : 'Medium',
        rawPriority: t.priority || 'medium',
        completed: t.status === 'done' || t.status === 'completed',
        dueDate: t.due_date
          ? new Date(t.due_date).toLocaleDateString()
          : 'No due date',
      }));
      setTaskList(formatted);
    } catch (e) {
      if (showError) showError('Failed to load tasks: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const toggleTask = async (task) => {
    const newStatus = task.completed ? 'todo' : 'done';
    try {
      await apiUpdateTask(task.id, { status: newStatus });
      setTaskList(
        taskList.map((t) =>
          t.id === task.id ? { ...t, completed: !t.completed } : t
        )
      );
      if (showSuccess)
        showSuccess(
          `Task marked as ${newStatus === 'done' ? 'completed' : 'active'}`
        );
    } catch (e) {
      if (showError) showError('Failed to update task: ' + e.message);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await apiCreateTask({
        title: newTaskTitle.trim(),
        description: '',
        priority: newTaskPriority,
        status: 'todo',
      });
      if (showSuccess) showSuccess('Task created!');
      setNewTaskTitle('');
      fetchTasks();
    } catch (e) {
      if (showError) showError('Failed to create task: ' + e.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await apiDeleteTask(taskId);
      setTaskList(taskList.filter((item) => item.id !== taskId));
      if (showSuccess) showSuccess('Task deleted!');
    } catch (e) {
      if (showError) showError('Failed to delete task: ' + e.message);
    }
  };

  const filteredTasks = taskList.filter((t) => {
    if (filter === 'Active') return !t.completed;
    if (filter === 'Completed') return t.completed;
    if (filter === 'High Priority') return t.priority === 'High';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100">
            Tasks & Productivity
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Manage priorities, project deliverables, and automated AI workflow triggers
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 bg-surface-container-low dark:bg-slate-800 p-1.5 rounded-xl border border-outline-variant/30 dark:border-slate-700">
          {['All', 'Active', 'Completed', 'High Priority'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Task Form */}
      <form onSubmit={handleAddTask} className="mb-8 flex gap-3">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary shadow-sm"
        />
        <select
          value={newTaskPriority}
          onChange={(e) => setNewTaskPriority(e.target.value)}
          className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-on-surface dark:text-slate-200 focus:outline-none focus:border-primary"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <button
          type="submit"
          className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>Add Task</span>
        </button>
      </form>

      {/* Task Cards List */}
      {loading ? (
        <div className="text-center py-10 text-xs text-on-surface-variant flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-base">sync</span>
          <span>Loading tasks from database...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/30 dark:border-slate-700 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">task_alt</span>
          <p className="text-sm font-semibold">No tasks found in this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTask(t)}
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <div>
                  <p
                    className={`font-label text-sm font-medium text-on-surface dark:text-slate-200 ${
                      t.completed ? 'line-through text-on-surface-variant/60 dark:text-slate-500' : ''
                    }`}
                  >
                    {t.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant dark:text-slate-400">
                    <span className="bg-surface-container-low dark:bg-slate-700 px-2 py-0.5 rounded text-[11px]">
                      {t.category}
                    </span>
                    <span>Due: {t.dueDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    t.priority === 'High'
                      ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                      : t.priority === 'Medium'
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.priority}
                </span>
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-opacity p-1"
                  title="Delete task"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
