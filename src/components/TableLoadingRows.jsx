import './styles/TableLoadingRows.css';

export function TableLoadingRows({ colSpan, rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="tlr-row">
          <td colSpan={colSpan}>
            <div className="tlr-bar" />
          </td>
        </tr>
      ))}
    </>
  );
}
