import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { searchInstructions } from '../../../store/instructionsSlice.js';
import { PAGE_SIZE } from '../../../constants.js';

export default function useInstructionEditor({ query, catalogId, isAdmin }) {
  const dispatch = useDispatch();
  const [editingInstruction, setEditingInstruction] = useState(null);

  function openInstructionEditor(instruction) {
    if (isAdmin) setEditingInstruction(instruction);
  }
  function closeInstructionEditor() {
    setEditingInstruction(null);
  }
  function instructionSaved() {
    closeInstructionEditor();
    dispatch(searchInstructions({ query, catalogId, page: 1, pageSize: PAGE_SIZE }));
  }
  return { editingInstruction, openInstructionEditor, closeInstructionEditor, instructionSaved };
}
