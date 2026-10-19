import InstructionButton from '../InstructionButton/InstructionButton.jsx';
import InstructionGenerationCard from '../InstructionList/InstructionGenerationCard.jsx';
import RevealItem from '../InstructionList/InstructionListRevealItem.jsx';

import listStyles from '../InstructionList/InstructionList.module.css';

export default function InstructionsCatalogGrid({ items, isAdmin }) {
  return (
    <ul className={listStyles.list}>
      {items.map((instruction, index) => (
        <RevealItem key={instruction.id} delay={(index % 3) * 90}>
          <InstructionButton instruction={instruction} isAdmin={isAdmin} showAdminActions={false} />
        </RevealItem>
      ))}

      <InstructionGenerationCard delay={(items.length % 3) * 90} />
    </ul>
  );
}
