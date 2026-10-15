import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../../store/authSlice.js';
import {
  fetchAdminArticle,
  fetchAdminArticles,
  removeAdminArticle,
  saveAdminArticle,
} from './adminArticlesApi.js';
import { getDraftKey, removeArticleDraft } from './articleForm.js';
import ArticlesList from './ArticlesList.jsx';
import ArticleForm from './ArticleForm.jsx';
import './AdminArticles.css';

export default function AdminArticles({ token, hidden = false }) {
  const user = useSelector(selectAuthUser);
  const identity = user?.id || user?.login || user?.email || 'admin';
  const [items, setItems] = useState([]);
  const [record, setRecord] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminArticles(token);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function openArticle(id) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await fetchAdminArticle(token, id);
      setRecord(data.article);
      setEditing(true);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveArticle(form) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await saveAdminArticle(token, form, record);
      removeArticleDraft(getDraftKey(identity, record?.id));
      setRecord(data.article);
      setItems(current => [data.article, ...current.filter(item => item.id !== data.article.id)]);
      setMessage(
        data.article.status === 'published'
          ? 'Статья сохранена и опубликована.'
          : 'Черновик сохранён.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteArticle(article) {
    if (!window.confirm(`Удалить статью «${article.title}»? Это действие нельзя отменить.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await removeAdminArticle(token, article);
      removeArticleDraft(getDraftKey(identity, article.id));
      setItems(current => current.filter(item => item.id !== article.id));
      setMessage('Статья удалена.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section hidden={hidden} className="admin-articles" data-boykov-admin-tab-section="articles">
      <div className="admin-articles__head">
        <div>
          <div className="admin-articles__eyebrow">Публикации</div>
          <h2>Статьи</h2>
          <p>
            Полезные материалы с полными инструкциями и скачиванием для зарегистрированных
            пользователей.
          </p>
        </div>
        {!editing && (
          <button
            className="admin-articles__primary"
            type="button"
            disabled={busy}
            onClick={() => {
              setRecord(null);
              setEditing(true);
              setError('');
              setMessage('');
            }}
          >
            Создать статью
          </button>
        )}
      </div>
      {error && (
        <div className="admin-articles__error" role="alert">
          {error}{' '}
          <button type="button" onClick={reload} disabled={loading}>
            Повторить загрузку
          </button>
        </div>
      )}
      {message && (
        <p className="admin-articles__success" role="status">
          {message}
        </p>
      )}
      {editing ? (
        <ArticleForm
          key={record ? `${record.id}:${record.revision}` : 'new'}
          record={record || undefined}
          identity={identity}
          saving={busy}
          onSave={saveArticle}
          onClose={() => {
            setEditing(false);
            setMessage('');
          }}
        />
      ) : (
        <ArticlesList
          items={items}
          loading={loading}
          busy={busy}
          onOpen={openArticle}
          onDelete={deleteArticle}
        />
      )}
    </section>
  );
}
