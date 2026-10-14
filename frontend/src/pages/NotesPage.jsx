import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  apiGetNotes,
  apiCreateNote,
  apiUpdateNote,
  apiDeleteNote,
} from '../services/api';

export default function NotesPage() {
  const { showError, showSuccess } = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [noteForm, setNoteForm] = useState({
    id: null,
    title: '',
    content: '',
    tags: '',
  });

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await apiGetNotes();
      const rawNotes = res?.data || [];
      const formatted = rawNotes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: Array.isArray(n.tags) ? n.tags : [],
        date: n.created_at
          ? new Date(n.created_at).toLocaleDateString()
          : 'Recently',
      }));
      setNotes(formatted);
    } catch (e) {
      if (showError) showError('Failed to load notes: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleOpenCreateModal = () => {
    setNoteForm({ id: null, title: '', content: '', tags: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (note) => {
    setNoteForm({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: (note.tags || []).join(', '),
    });
    setShowModal(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title.trim() || !noteForm.content.trim()) return;

    const tagsArray = noteForm.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (noteForm.id) {
        // Update
        await apiUpdateNote(noteForm.id, {
          title: noteForm.title.trim(),
          content: noteForm.content.trim(),
          tags: tagsArray,
        });
        if (showSuccess) showSuccess('Note updated successfully!');
      } else {
        // Create
        await apiCreateNote({
          title: noteForm.title.trim(),
          content: noteForm.content.trim(),
          tags: tagsArray,
        });
        if (showSuccess) showSuccess('Note created successfully!');
      }

      setShowModal(false);
      fetchNotes();
    } catch (err) {
      if (showError) showError('Failed to save note: ' + err.message);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await apiDeleteNote(noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
      if (selectedNote?.id === noteId) setSelectedNote(null);
      if (showSuccess) showSuccess('Note deleted');
    } catch (e) {
      if (showError) showError('Failed to delete note: ' + e.message);
    }
  };

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchesTitle = n.title.toLowerCase().includes(q);
    const matchesContent = n.content.toLowerCase().includes(q);
    const matchesTags = n.tags.some((t) => t.toLowerCase().includes(q));
    return matchesTitle || matchesContent || matchesTags;
  });

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-12 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">note_alt</span>
            Notes & Knowledge
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Create, view, search, and manage your personal notes synced with FastAPI database
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-4 py-2 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl text-sm text-on-surface dark:text-slate-200 focus:outline-none focus:border-primary shadow-sm"
            />
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-1.5 active:scale-95 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="text-center py-12 text-xs text-on-surface-variant flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-base animate-spin">sync</span>
          <span>Loading notes from MongoDB Atlas...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-surface dark:bg-slate-800 rounded-3xl border border-outline-variant/30 dark:border-slate-700 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2 text-slate-400">note_stack</span>
          <p className="text-base font-bold text-on-surface dark:text-slate-200">No notes found</p>
          <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1">
            Click "New Note" above to create your first note document.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:border-primary/50 relative"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-headline text-base font-bold text-on-surface dark:text-slate-100 group-hover:text-primary transition-colors truncate max-w-[200px]">
                    {note.title}
                  </h3>
                  <span className="text-[10px] text-on-surface-variant dark:text-slate-400">
                    {note.date}
                  </span>
                </div>

                <p className="font-body text-xs text-on-surface-variant dark:text-slate-300 line-clamp-4 leading-relaxed mb-4 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>

              <div className="pt-3 border-t border-outline-variant/30 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {note.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-primary/10 text-primary dark:text-blue-300 font-semibold px-2 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(note);
                    }}
                    className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                    title="Edit Note"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    className="p-1 text-on-surface-variant hover:text-red-500 transition-colors"
                    title="Delete Note"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note Detail Modal */}
      {selectedNote && !showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-outline-variant/30 dark:border-slate-700">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100">
                  {selectedNote.title}
                </h3>
                <span className="text-xs text-on-surface-variant dark:text-slate-400">
                  {selectedNote.date}
                </span>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto pr-1 mb-6">
              <p className="font-body text-sm text-on-surface dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedNote.content}
              </p>
            </div>

            <div className="flex justify-between items-center border-t border-outline-variant/30 dark:border-slate-700 pt-4">
              <div className="flex flex-wrap gap-1.5">
                {selectedNote.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-primary/10 text-primary dark:text-blue-300 font-semibold px-2.5 py-0.5 rounded-lg"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const noteToEdit = selectedNote;
                    setSelectedNote(null);
                    handleOpenEditModal(noteToEdit);
                  }}
                  className="px-4 py-2 bg-surface-container-high dark:bg-slate-700 text-xs font-semibold text-on-surface rounded-xl hover:bg-surface-container-highest"
                >
                  Edit
                </button>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Note Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/30 dark:border-slate-700">
              <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">
                {noteForm.id ? 'Edit Note' : 'Create New Note'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  placeholder="e.g. Architecture Overview"
                  className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                  Note Content
                </label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  placeholder="Write your note here..."
                  className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  rows={6}
                  required
                />
              </div>

              <div>
                <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={noteForm.tags}
                  onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
                  placeholder="e.g. Work, Ideas, Meeting"
                  className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2 text-xs text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-surface-container-high dark:bg-slate-700 text-xs font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container-highest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-md"
                >
                  {noteForm.id ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
