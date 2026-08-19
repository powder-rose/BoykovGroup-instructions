import InstructionButton from "../InstructionButton/InstructionButton.jsx";
import styles from "./InstructionList.module.css";

export default function InstructionList({ instructions, onSelect, isAdmin, onDelete, deletingId }) {
  return (
    <ul className={styles.list}>
      {instructions.map((instruction) => (
        <li key={instruction.id}>
          <InstructionButton
            instruction={instruction}
            onSelect={onSelect}
            isAdmin={isAdmin}
            onDelete={onDelete}
            isDeleting={deletingId === instruction.id}
          />
        </li>
      ))}
    </ul>
  );
}
