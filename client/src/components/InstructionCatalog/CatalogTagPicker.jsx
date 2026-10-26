import CatalogOptionPicker from './CatalogOptionPicker.jsx';

export default function CatalogTagPicker({ tags, ...props }) {
  return (
    <CatalogOptionPicker
      {...props}
      options={tags}
      label="Тег"
      placeholder="Найдите и выберите тег"
      clearLabel="Сбросить выбранный тег"
      showLabel="Показать список тегов"
      hideLabel="Скрыть список тегов"
    />
  );
}
