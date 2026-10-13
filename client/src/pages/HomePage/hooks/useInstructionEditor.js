import {
  useState
} from "react";

import {
  useDispatch,
  useSelector
} from "react-redux";

import {
  selectAuthToken
} from "../../../store/authSlice.js";

import {
  searchInstructions
} from "../../../store/instructionsSlice.js";

import {
  updateInstruction
} from "../../../api/instructionsApi.js";

import {
  PAGE_SIZE
} from "../../../constants.js";


export default function useInstructionEditor({

  query,
  isAdmin

}) {

  const dispatch =
    useDispatch();

  const authToken =
    useSelector(
      selectAuthToken
    );


  const [
    editingInstruction,
    setEditingInstruction
  ] =
    useState(null);


  async function openInstructionEditor(
    instruction
  ) {

    const response =
      await fetch(
        `/api/instructions/${instruction.id}`
      );


    if (!response.ok) {
      return;
    }


    const fullInstruction =
      await response.json();


    setEditingInstruction(
      fullInstruction
    );

  }


  function closeInstructionEditor() {

    setEditingInstruction(
      null
    );

  }


  async function saveInstruction(
    updated
  ) {

    if (
      !isAdmin ||
      !authToken
    ) {
      return;
    }


    try {

      await updateInstruction(
        updated.id,
        updated,
        authToken
      );


      closeInstructionEditor();


      dispatch(
        searchInstructions({
          query,

          page:
            1,

          pageSize:
            PAGE_SIZE
        })
      );

    }
    catch (error) {

      console.error(
        "Instruction save error:",
        error
      );

    }

  }


  return {
    editingInstruction,
    openInstructionEditor,
    closeInstructionEditor,
    saveInstruction
  };

}
