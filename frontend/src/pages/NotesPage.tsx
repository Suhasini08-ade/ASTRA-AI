import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Pin, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Tag, 
  Check, 
  X,
  FileText
} from 'lucide-react';
import { Note } from '../types';
import { sendChatMessage, createNoteApi, deleteNoteApi } from '../services/api';

interface NotesPageProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

export const NotesPage: React.FC<NotesPageProps> = ({
  notes,
  setNotes,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<Note['category']>('Work');
  const [formColor, setFormColor] = useState('from-blue-600/20 to-indigo-600/20 border-blue-500/30');
  const [formTags, setFormTags] = useState('');

  const categories = ['All', 'Work', 'Personal', 'Ideas', 'Projects', 'Research'];

  const colors = [
    { name: 'Blue', value: 'from-blue-600/20 to-indigo-600/20 border-blue-500/30' },
    { name: 'Purple', value: 'from-purple-600/20 to-pink-600/20 border-purple-500/30' },
    { name: 'Cyan', value: 'from-cyan-600/20 to-teal-600/20 border-cyan-500/30' },
    { name: 'Amber', value: 'from-amber-600/20 to-orange-600/20 border-amber-500/30' },
    { name: 'Emerald', value: 'from-emerald-600/20 to-teal-600/20 border-emerald-500/30' },
  ];

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('Work');
    setFormColor(colors[0].value);
    setFormTags('Productivity');
    setShowModal(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormCategory(note.category);
    setFormColor(note.color);
    setFormTags(note.tags.join(', '));
    setShowModal(true);
  };

  const handleSaveNote = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    const parsedTags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    if (editingNote) {
      setNotes(prev =>
        prev.map(n =>
          n.id === editingNote.id
            ? {
                ...n,
                title: formTitle,
                content: formContent,
                category: formCategory,
                color: formColor,
                tags: parsedTags,
                updatedAt: 'Just now',
              }
            : n
        )
      );
    } else {
      const createdNote = await createNoteApi(formTitle, formContent, parsedTags.length ? parsedTags : ['General']);
      if (createdNote) {
        setNotes(prev => [
          {
            ...createdNote,
            category: formCategory,
            color: formColor,
          },
          ...prev,
        ]);
      } else {
        const fallbackNote: Note = {
          id: `note-${Date.now()}`,
          title: formTitle,
          content: formContent,
          category: formCategory,
          color: formColor,
          isPinned: false,
          updatedAt: 'Just now',
          tags: parsedTags.length ? parsedTags : ['General'],
        };
        setNotes(prev => [fallbackNote, ...prev]);
      }
    }

    setShowModal(false);
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      await deleteNoteApi(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  // AI Polish / Enhance Note Text
  const handleAiPolishNote = async () => {
    if (!formContent.trim()) return;
    setIsPolishing(true);
    try {
      const prompt = [
        {
          role: 'user',
          content: `Please refine and structure this note for executive clarity and professional markdown format:\n\nTitle: ${formTitle}\nContent: ${formContent}`,
        },
      ];
      const polished = await sendChatMessage(prompt, 'You are an AI Note Editor. Improve structure, fix grammar, and format key points with clean markdown bullet points.');
      setFormContent(polished);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPolishing(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch =
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content.toLowerCase().includes(search.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' || note.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const otherNotes = filteredNotes.filter(n => !n.isPinned);

  return (
    <div className="space-y-6 text-left">
      
      {/* Top Header & Search Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <FileText className="w-6 h-6 text-amber-400" />
            <span>Smart Notes Workspace</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize thoughts, research notes, and strategic ideas with AI polishing
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Note</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes or tags..."
            className="w-full bg-slate-900 border border-white/10 focus:border-amber-500/50 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {/* Pinned Notes Section */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
            <Pin className="w-3.5 h-3.5 fill-current" />
            <span>Pinned Notes ({pinnedNotes.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map(note => renderNoteCard(note))}
          </div>
        </div>
      )}

      {/* All / Other Notes Grid */}
      <div className="space-y-3">
        {pinnedNotes.length > 0 && (
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Other Notes ({otherNotes.length})
          </h2>
        )}

        {filteredNotes.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-3">
            <p className="text-slate-400 text-sm">No notes match your filter or search criteria.</p>
            <button
              onClick={handleOpenCreateModal}
              className="text-xs text-amber-400 font-bold hover:underline"
            >
              + Create a new note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherNotes.map(note => renderNoteCard(note))}
          </div>
        )}
      </div>

      {/* Create / Edit Note Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-3xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">
                  {editingNote ? 'Edit Note' : 'Create New Note'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Note Title..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as Note['category'])}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      {categories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Color Label</label>
                    <select
                      value={formColor}
                      onChange={e => setFormColor(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      {colors.map(c => (
                        <option key={c.name} value={c.value}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-300">Content</label>
                    <button
                      type="button"
                      onClick={handleAiPolishNote}
                      disabled={isPolishing || !formContent.trim()}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 disabled:opacity-40"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>{isPolishing ? 'Polishing Note...' : 'AI Polish Note'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    placeholder="Write your note markdown or thoughts here..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    placeholder="Architecture, Gemini, Sprint-3"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  function renderNoteCard(note: Note) {
    return (
      <motion.div
        key={note.id}
        onClick={() => handleOpenEditModal(note)}
        whileHover={{ y: -3 }}
        className={`p-5 rounded-3xl bg-gradient-to-br ${note.color} backdrop-blur-xl border border-white/10 hover:border-amber-500/40 shadow-lg cursor-pointer transition-all space-y-3 relative group text-left`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/10">
            {note.category}
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={e => handleTogglePin(note.id, e)}
              className={`p-1.5 rounded-lg transition-colors ${
                note.isPinned ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white'
              }`}
              title="Pin Note"
            >
              <Pin className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={e => handleDeleteNote(note.id, e)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
              title="Delete Note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white line-clamp-1">{note.title}</h3>
          <p className="text-xs text-slate-300 mt-1 line-clamp-3 whitespace-pre-wrap">
            {note.content}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-400">
          <div className="flex flex-wrap gap-1">
            {note.tags.map((tag, idx) => (
              <span key={idx} className="bg-slate-900/60 text-slate-300 px-1.5 py-0.5 rounded">
                #{tag}
              </span>
            ))}
          </div>
          <span>{note.updatedAt}</span>
        </div>
      </motion.div>
    );
  }
};
