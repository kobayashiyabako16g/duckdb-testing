interface BaseProps {
  yyyy: number;
  mm: number;
  onChange: (next: { yyyy: number; mm: number; dd?: number }) => void;
}

interface DayProps extends BaseProps {
  mode: "day";
  dd: number;
}

interface MonthProps extends BaseProps {
  mode: "month";
  dd?: undefined;
}

export type DateSelectorProps = DayProps | MonthProps;

const YEAR_RANGE = 5;

function daysInMonth(yyyy: number, mm: number): number {
  return new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
}

export function DateSelector(props: DateSelectorProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear - YEAR_RANGE + 1; y <= currentYear; y++) years.push(y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleYearChange = (yyyy: number) => {
    if (props.mode === "day") {
      const maxDay = daysInMonth(yyyy, props.mm);
      const dd = Math.min(props.dd, maxDay);
      props.onChange({ yyyy, mm: props.mm, dd });
    } else {
      props.onChange({ yyyy, mm: props.mm });
    }
  };

  const handleMonthChange = (mm: number) => {
    if (props.mode === "day") {
      const maxDay = daysInMonth(props.yyyy, mm);
      const dd = Math.min(props.dd, maxDay);
      props.onChange({ yyyy: props.yyyy, mm, dd });
    } else {
      props.onChange({ yyyy: props.yyyy, mm });
    }
  };

  const handleDayChange = (dd: number) => {
    if (props.mode === "day") {
      props.onChange({ yyyy: props.yyyy, mm: props.mm, dd });
    }
  };

  const selectClass =
    "px-2 py-1 border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600";

  return (
    <div className="flex items-center gap-2">
      <select
        className={selectClass}
        value={props.yyyy}
        onChange={(e) => handleYearChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <span>年</span>
      <select
        className={selectClass}
        value={props.mm}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span>月</span>
      {props.mode === "day" && (
        <>
          <select
            className={selectClass}
            value={props.dd}
            onChange={(e) => handleDayChange(Number(e.target.value))}
          >
            {Array.from({ length: daysInMonth(props.yyyy, props.mm) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
          <span>日</span>
        </>
      )}
    </div>
  );
}

export function getJstToday(): { yyyy: number; mm: number; dd: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { yyyy: get("year"), mm: get("month"), dd: get("day") };
}
