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
              <td key={index} className="border p-2">
                {value.CsvID}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
