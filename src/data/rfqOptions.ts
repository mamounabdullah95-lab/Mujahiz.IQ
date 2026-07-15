export type RfqLocale = "ar" | "en";

export type RfqOption = {
  value: string;
  labelAr: string;
  labelEn: string;
};

export const rfqUnitOptions: RfqOption[] = [
  { value: "piece", labelAr: "قطعة", labelEn: "Piece" },
  { value: "set", labelAr: "طقم", labelEn: "Set" },
  { value: "pack", labelAr: "حزمة", labelEn: "Pack" },
  { value: "box", labelAr: "صندوق", labelEn: "Box" },
  { value: "carton", labelAr: "كرتون", labelEn: "Carton" },
  { value: "bag", labelAr: "كيس", labelEn: "Bag" },
  { value: "roll", labelAr: "لفة", labelEn: "Roll" },
  { value: "pallet", labelAr: "منصة تحميل", labelEn: "Pallet" },
  { value: "meter", labelAr: "متر", labelEn: "Meter" },
  { value: "square_meter", labelAr: "متر مربع", labelEn: "Square meter" },
  { value: "cubic_meter", labelAr: "متر مكعب", labelEn: "Cubic meter" },
  { value: "liter", labelAr: "لتر", labelEn: "Liter" },
  { value: "kilogram", labelAr: "كيلوغرام", labelEn: "Kilogram" },
  { value: "ton", labelAr: "طن", labelEn: "Ton" },
  { value: "hour", labelAr: "ساعة عمل", labelEn: "Work hour" },
  { value: "day", labelAr: "يوم عمل", labelEn: "Work day" },
  { value: "other", labelAr: "أخرى", labelEn: "Other" },
];

export const rfqPaymentTermOptions: RfqOption[] = [
  { value: "cash_on_delivery", labelAr: "الدفع عند الاستلام", labelEn: "Cash on delivery" },
  { value: "full_advance", labelAr: "دفع مقدم بالكامل", labelEn: "Full advance payment" },
  { value: "partial_advance", labelAr: "دفعة مقدمة والباقي عند الاستلام", labelEn: "Partial advance, balance on delivery" },
  { value: "net_15", labelAr: "أجل 15 يوماً", labelEn: "Net 15 days" },
  { value: "net_30", labelAr: "أجل 30 يوماً", labelEn: "Net 30 days" },
  { value: "net_45", labelAr: "أجل 45 يوماً", labelEn: "Net 45 days" },
  { value: "net_60", labelAr: "أجل 60 يوماً", labelEn: "Net 60 days" },
  { value: "bank_transfer", labelAr: "تحويل مصرفي", labelEn: "Bank transfer" },
  { value: "letter_of_credit", labelAr: "اعتماد مستندي", labelEn: "Letter of credit" },
  { value: "on_completion", labelAr: "عند إكمال العمل", labelEn: "On completion" },
  { value: "other", labelAr: "أخرى", labelEn: "Other" },
];

export const rfqDeliveryTermOptions: RfqOption[] = [
  { value: "supplier_delivery", labelAr: "التوصيل بواسطة المجهز", labelEn: "Supplier delivery" },
  { value: "buyer_pickup", labelAr: "الاستلام من مقر المجهز", labelEn: "Buyer pickup" },
  { value: "site_delivery", labelAr: "التوصيل إلى موقع المشروع", labelEn: "Delivery to project site" },
  { value: "door_to_door", labelAr: "التوصيل من الباب إلى الباب", labelEn: "Door-to-door delivery" },
  { value: "scheduled_delivery", labelAr: "دفعات مجدولة حسب الطلب", labelEn: "Scheduled partial deliveries" },
  { value: "freight_included", labelAr: "أجور الشحن مشمولة", labelEn: "Freight included" },
  { value: "freight_excluded", labelAr: "أجور الشحن غير مشمولة", labelEn: "Freight excluded" },
  { value: "ex_works", labelAr: "تسليم من المصنع (EXW)", labelEn: "Ex Works (EXW)" },
  { value: "other", labelAr: "أخرى", labelEn: "Other" },
];

export const rfqPreferredCurrencyOptions: RfqOption[] = [
  { value: "IQD", labelAr: "دينار عراقي (IQD)", labelEn: "Iraqi dinar (IQD)" },
  { value: "USD", labelAr: "دولار أمريكي (USD)", labelEn: "US dollar (USD)" },
  { value: "either", labelAr: "الدينار أو الدولار", labelEn: "IQD or USD" },
];

export function rfqOptionLabel(
  options: RfqOption[],
  value: string | undefined,
  locale: RfqLocale,
  otherValue?: string,
) {
  if (!value) return "—";
  if (value === "other" && otherValue?.trim()) return otherValue.trim();
  const option = options.find((item) => item.value === value);
  return option ? (locale === "ar" ? option.labelAr : option.labelEn) : value;
}
