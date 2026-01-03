import { getKBeautyExportData, convertToIndicator } from './korea-customs';

export async function getAllIndicators(hsCode?: string, hsCode2?: string) {
  // Fetch from our specialized K-Beauty Mock API
  const [total, us, cn, jp, fr, mx, ae, others] = await getKBeautyExportData(hsCode, hsCode2);

  // Safeguard: if new countries are missing (old cache?), fallback to others or empty
  const safeConvert = (d: any) => d ? convertToIndicator(d) : convertToIndicator(others || total);

  return {
    totalExport: convertToIndicator(total),
    usExport: convertToIndicator(us),
    cnExport: convertToIndicator(cn),
    jpExport: convertToIndicator(jp),
    frExport: safeConvert(fr),
    mxExport: safeConvert(mx),
    aeExport: safeConvert(ae),
    othersExport: convertToIndicator(others),
  };
}
