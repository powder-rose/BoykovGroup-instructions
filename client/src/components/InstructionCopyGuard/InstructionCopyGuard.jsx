export default function InstructionCopyGuard({
  as: Container = 'div',
  allowCopy = false,
  children,
  ...props
}) {
  return (
    <Container {...props} data-copy-protected={allowCopy ? undefined : 'true'}>
      {children}
    </Container>
  );
}
