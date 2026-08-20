import React from "react";

/**
 * SEO-friendly link to an instruction.
 *
 * Normal left click:
 *   keeps the current SPA/modal behaviour through onSelect().
 *
 * Search robots / open in new tab / Ctrl / Cmd / Shift click:
 *   use the real server URL /instructions/:id.
 */
export default function InstructionSeoLink({
  instruction,
  onSelect,
  className,
  children,
}) {
  if (!instruction?.id) {
    return children ?? instruction?.title ?? null;
  }

  const href = `/instructions/${encodeURIComponent(instruction.id)}`;

  const handleClick = (event) => {
    const isModifiedClick =
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0;

    if (isModifiedClick || typeof onSelect !== "function") {
      return;
    }

    // Preserve the current modal/SPA UX for a normal click.
    event.preventDefault();
    onSelect(instruction.id);
  };

  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
    >
      {children ?? instruction.title}
    </a>
  );
}
