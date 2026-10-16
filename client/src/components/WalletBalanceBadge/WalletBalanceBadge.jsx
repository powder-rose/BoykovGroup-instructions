import { useSelector } from 'react-redux';

import { selectAuthUser } from '../../store/authSlice.js';
import { useWalletBalance } from '../../contexts/WalletBalanceContext.jsx';
import { formatRubles } from '../../../public/assets/wallet-client.js';
import styles from './WalletBalanceBadge.module.css';

export default function WalletBalanceBadge() {
  const user = useSelector(selectAuthUser);
  const { balanceMinor } = useWalletBalance();
  if (user?.role !== 'user') return null;

  const amount = balanceMinor === null ? '—' : formatRubles(balanceMinor);

  return (
    <a
      className={styles.badge}
      href="/account/"
      title="Баланс и купленные инструкции"
      aria-label={`Баланс: ${amount}. Личный кабинет`}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>Баланс</span>
      <span className={styles.amount} aria-live="polite">
        {amount}
      </span>
    </a>
  );
}
