export interface HSKItem {
    id: string;
    group: 'Basic' | 'Makeup' | 'Hair' | 'Cleansing' | 'Other';
    label: string;
    hsCode: string;
    hsCode2?: string; // For combined items like Mask Packs
    note?: string;
}

export type HSKGroup = HSKItem['group'];

export const HSK_MAPPING: HSKItem[] = [
    // 기초 (Basic)
    { id: 'basic_set', group: 'Basic', label: '기초화장품 세트 (Basic Set)', hsCode: '3304991000', note: '토너, 로션, 크림 등 기초 전반' },
    { id: 'mask_gel', group: 'Basic', label: '마스크팩 (겔/페이스트)', hsCode: '3304991000', note: '바르는 형태' },
    // Wait, user said 3304991000 for Gel Mask? Same as Basic Set?
    // User input: "기초화장품 세트 3304991000", "마스크팩 (겔/페이스트) 3304991000"
    // This implies they share the code. 
    // Should I separate them? If the code is identical, the data is identical.
    // The user might be distinguishing logically, but API-wise it's the same.
    // I will follow the user's list, but note the duplicate code.

    { id: 'mask_sheet', group: 'Basic', label: '마스크팩 (부직포/시트)', hsCode: '3307904000', note: '[주의] 3307호 분류' },
    { id: 'mask_total', group: 'Basic', label: '마스크팩 전체 합산 (Total Mask Pack)', hsCode: '3304991000', hsCode2: '3307904000', note: '겔(3304) + 시트(3307) 합산' },
    { id: 'functional', group: 'Basic', label: '기능성 화장품', hsCode: '3304999000', note: '미백, 주름개선 등 기타' },

    // 색조 (Makeup)
    { id: 'lipstick', group: 'Makeup', label: '립스틱', hsCode: '3304101000', note: '입술화장용 대표' },
    { id: 'lipgloss', group: 'Makeup', label: '립글로스 / 립밤', hsCode: '3304109000', note: '기타 입술용' },
    { id: 'eyeshadow', group: 'Makeup', label: '아이섀도', hsCode: '3304201000', note: '눈화장용 대표' },
    { id: 'mascara', group: 'Makeup', label: '마스카라 / 아이라이너', hsCode: '3304209000', note: '기타 눈화장용' },
    { id: 'facepowder', group: 'Makeup', label: '페이스 파우더', hsCode: '3304911000', note: '가루/쿠션 팩트류' },

    // 두발 (Hair)
    { id: 'shampoo', group: 'Hair', label: '샴푸', hsCode: '3305100000', note: '세정용 두발 제품' },
    { id: 'conditioner', group: 'Hair', label: '헤어린스 / 컨디셔너', hsCode: '3305901000', note: '케어용 두발 제품' },

    // 세정 (Cleansing)
    { id: 'cleanser', group: 'Cleansing', label: '폼 클렌저 / 바디 워시', hsCode: '3401300000', note: '[주의] 3401호 (유기계면활성제품)' },
    { id: 'soap', group: 'Cleansing', label: '화장 비누 (세안용)', hsCode: '3401119000', note: '고체형 비누' },

    // 기타 (Other)
    { id: 'perfume', group: 'Other', label: '향수', hsCode: '3303001000', note: '방향용 제품' },
    { id: 'deodorant', group: 'Other', label: '데오도런트', hsCode: '3307200000', note: '체취방지용' },
];

export const GROUP_LABELS: Record<HSKGroup, string> = {
    Basic: '기초 (Basic)',
    Makeup: '색조 (Makeup)',
    Hair: '두발 (Hair)',
    Cleansing: '세정 (Cleansing)',
    Other: '기타 (Other)',
};
