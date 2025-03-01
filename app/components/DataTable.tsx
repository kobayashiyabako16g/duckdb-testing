type Props = {
  data: any[];
};

export function DataTable({ data }: Props) {
  return (
    <table className="w-full border-collapse border">
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
