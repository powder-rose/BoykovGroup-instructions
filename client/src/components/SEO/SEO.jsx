import { useEffect } from 'react';

export default function SEO({ title, description, noindex = false }) {
  useEffect(() => {
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }

    meta.content = description;
  }, [title, description]);

  useEffect(() => {
    if (!noindex) return undefined;
    let robots = document.querySelector('meta[name="robots"]');
    const previous = robots?.content;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.append(robots);
    }
    robots.content = 'noindex, nofollow';
    return () => {
      if (previous === undefined || previous === 'noindex, nofollow') robots.remove();
      else robots.content = previous;
    };
  }, [noindex]);

  return null;
}
