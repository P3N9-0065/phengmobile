import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
};

export function Barcode({ value, height = 50, width = 1.6, fontSize = 12, displayValue = true, className }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        background: "transparent",
      });
    } catch {
      // ignore invalid barcode values
    }
  }, [value, height, width, fontSize, displayValue]);

  if (!value) return null;
  return <svg ref={ref} className={className} />;
}
