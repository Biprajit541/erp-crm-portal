interface Props {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}
export default function Pager({ page, pages, onPage }: Props) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn secondary small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}