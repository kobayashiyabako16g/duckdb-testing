type Props = {
  data: any[];
};

export function DataTable({ data }: Props) {
  const keys = data.slice(0, 1).map((obj) => Object.keys(obj))[0];
  return (
    <table className="w-full border-collapse border">
      {keys !== undefined && keys.length !== 0 && (
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key} className="border p-2">
                {key}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {data.map((value, index) => {
          return (
            <tr key={index}>
              {Object.keys(value).map((key) => (
                <td key={key} className="border p-2">
                  {value[key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
