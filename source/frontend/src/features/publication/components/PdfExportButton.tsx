import { App, Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/forms/applyFieldErrors';
import { createPdfExport, downloadPdfExport } from '../api/publication';
import { usePdfExport } from '../hooks/usePublication';

interface PdfExportButtonProps {
  programId: string;
  versionId: string;
}

// US-111: ask the server for a PDF, wait for the worker, then download it once. A Draft comes back marked
// "BẢN NHÁP" on every page; the button never builds the file in the browser.
export function PdfExportButton({
  programId,
  versionId,
}: PdfExportButtonProps) {
  const { message } = App.useApp();
  const [exportId, setExportId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const status = usePdfExport(exportId);
  const handled = useRef<string | null>(null);
  const state = status.data?.state;

  useEffect(() => {
    if (!exportId || !status.data || handled.current === exportId) return;
    if (state === 'READY') {
      handled.current = exportId;
      downloadPdfExport(exportId, status.data.fileName)
        .then(() => message.success('Đã tải file PDF.'))
        .catch((error: unknown) =>
          message.error(errorMessage(error, 'Không tải được file PDF.')),
        )
        .finally(() => setExportId(null));
    } else if (state === 'FAILED' || state === 'EXPIRED') {
      handled.current = exportId;
      message.error(status.data.failure ?? 'Không tạo được file PDF.');
      queueMicrotask(() => setExportId(null));
    }
  }, [exportId, state, status.data, message]);

  const start = async () => {
    setStarting(true);
    try {
      const created = await createPdfExport(programId, versionId);
      setExportId(created.id);
      if (created.draft)
        message.info('Phiên bản Nháp: file PDF sẽ có dấu "BẢN NHÁP".');
    } catch (error) {
      message.error(errorMessage(error, 'Không gửi được yêu cầu xuất PDF.'));
    } finally {
      setStarting(false);
    }
  };

  const working = starting || Boolean(exportId);
  return (
    <Button loading={working} onClick={() => void start()}>
      {working ? 'Đang tạo PDF…' : 'Xuất PDF'}
    </Button>
  );
}
