import { Tooltip, Typography } from 'antd';

interface ScopeCodesProps {
  codes: readonly string[];
  // What one code names: "CTĐT" for programmes, "nhóm" for subject groups.
  noun: string;
  // Wrap a single code in parentheses, as after an approver's name.
  parenthesised?: boolean;
}

const SHOWN = 3;

// A long list of programme or group codes, shortened to the first few and a count; the full list is in the tooltip.
export function ScopeCodes({
  codes,
  noun,
  parenthesised = false,
}: ScopeCodesProps) {
  if (codes.length === 0) return null;
  const wrap = (text: string) => (parenthesised ? `(${text})` : text);
  if (codes.length === 1)
    return <Typography.Text type="secondary">{wrap(codes[0])}</Typography.Text>;
  const rest = codes.length - SHOWN;
  const text = `${codes.length} ${noun}: ${codes.slice(0, SHOWN).join(', ')}${
    rest > 0 ? ` và ${rest} ${noun} khác` : ''
  }`;
  return (
    <Tooltip title={codes.join(', ')}>
      <Typography.Text type="secondary">{wrap(text)}</Typography.Text>
    </Tooltip>
  );
}
