import type { BusinessType, ConfidenceLevel, PlatformSettings, SourceType } from "../types/domain";

export interface OptionItem {
  value: string;
  labelEn: string;
  labelAr: string;
}

export const defaultSettings: PlatformSettings = {
  requiredApprovedSuppliersPerMonth: 10,
  daysGrantedPerBatch: 30,
  maximumStackableMonths: 12,
  gracePeriodDays: 3,
  trialAccessDays: 3,
  reviewsEarnBonusPoints: true,
  updateContributionsCanEarnAccessBonus: false,
};

export const governorates: OptionItem[] = [
  { value: "baghdad", labelEn: "Baghdad", labelAr: "بغداد" },
  { value: "basra", labelEn: "Basra", labelAr: "البصرة" },
  { value: "nineveh", labelEn: "Nineveh", labelAr: "نينوى" },
  { value: "erbil", labelEn: "Erbil", labelAr: "أربيل" },
  { value: "sulaymaniyah", labelEn: "Sulaymaniyah", labelAr: "السليمانية" },
  { value: "duhok", labelEn: "Duhok", labelAr: "دهوك" },
  { value: "kirkuk", labelEn: "Kirkuk", labelAr: "كركوك" },
  { value: "najaf", labelEn: "Najaf", labelAr: "النجف" },
  { value: "karbala", labelEn: "Karbala", labelAr: "كربلاء" },
  { value: "babil", labelEn: "Babil", labelAr: "بابل" },
  { value: "wasit", labelEn: "Wasit", labelAr: "واسط" },
  { value: "diyala", labelEn: "Diyala", labelAr: "ديالى" },
  { value: "anbar", labelEn: "Anbar", labelAr: "الأنبار" },
  { value: "salah_al_din", labelEn: "Salah al-Din", labelAr: "صلاح الدين" },
  { value: "dhi_qar", labelEn: "Dhi Qar", labelAr: "ذي قار" },
  { value: "maysan", labelEn: "Maysan", labelAr: "ميسان" },
  { value: "muthanna", labelEn: "Muthanna", labelAr: "المثنى" },
  { value: "qadisiyyah", labelEn: "Qadisiyyah", labelAr: "القادسية" },
];

export const businessTypes: OptionItem[] = [
  { value: "company", labelEn: "Company", labelAr: "شركة" },
  { value: "office", labelEn: "Office", labelAr: "مكتب" },
  { value: "workshop", labelEn: "Workshop", labelAr: "ورشة" },
  { value: "factory", labelEn: "Factory", labelAr: "معمل" },
  { value: "trader", labelEn: "Trader", labelAr: "تاجر" },
  { value: "authorized_distributor", labelEn: "Authorized distributor", labelAr: "وكيل معتمد" },
  { value: "importer", labelEn: "Importer", labelAr: "مستورد" },
  { value: "service_provider", labelEn: "Service provider", labelAr: "مزود خدمة" },
  { value: "individual_supplier", labelEn: "Individual supplier", labelAr: "مجهز فردي" },
  { value: "other", labelEn: "Other", labelAr: "أخرى" },
] satisfies Array<OptionItem & { value: BusinessType }>;

export const supplierCategories: OptionItem[] = [
  { value: "electrical_materials", labelEn: "Electrical materials", labelAr: "مواد كهربائية" },
  { value: "mechanical_materials", labelEn: "Mechanical materials", labelAr: "مواد ميكانيكية" },
  { value: "piping_materials", labelEn: "Piping materials", labelAr: "مواد الأنابيب" },
  { value: "flanges_fittings", labelEn: "Flanges and fittings", labelAr: "فلنجات ووصلات" },
  { value: "valves", labelEn: "Valves", labelAr: "صمامات" },
  { value: "instrumentation", labelEn: "Instrumentation", labelAr: "أجهزة قياس وسيطرة" },
  { value: "civil_construction", labelEn: "Civil and construction materials", labelAr: "مواد إنشائية ومدنية" },
  { value: "steel_fabrication", labelEn: "Steel and fabrication", labelAr: "حديد وتصنيع" },
  { value: "welding_machining", labelEn: "Welding and machining", labelAr: "لحام وخراطة" },
  { value: "safety_ppe", labelEn: "Safety and PPE", labelAr: "سلامة ومعدات حماية" },
  { value: "tools_equipment", labelEn: "Tools and equipment", labelAr: "عدد ومعدات" },
  { value: "heavy_equipment_rental", labelEn: "Heavy equipment rental", labelAr: "تأجير معدات ثقيلة" },
  { value: "transport_logistics", labelEn: "Transportation and logistics", labelAr: "نقل ولوجستيات" },
  { value: "office_supplies", labelEn: "Office supplies", labelAr: "مستلزمات مكتبية" },
  { value: "it_electronics", labelEn: "IT and electronics", labelAr: "تقنية ومعدات إلكترونية" },
  { value: "furniture", labelEn: "Furniture", labelAr: "أثاث" },
  { value: "chemicals", labelEn: "Chemicals", labelAr: "مواد كيمياوية" },
  { value: "oil_gas_materials", labelEn: "Oil and gas materials", labelAr: "مواد النفط والغاز" },
  { value: "power_plant_materials", labelEn: "Power plant materials", labelAr: "مواد محطات الطاقة" },
  { value: "general_trading", labelEn: "General trading", labelAr: "تجارة عامة" },
  { value: "maintenance_services", labelEn: "Maintenance services", labelAr: "خدمات صيانة" },
  { value: "printing_advertising", labelEn: "Printing and advertising", labelAr: "طباعة وإعلان" },
  { value: "other", labelEn: "Other", labelAr: "أخرى" },
];

export const defaultTaxonomyLists = {
  governorates,
  supplierCategories,
};

export const capabilityTags: OptionItem[] = [
  { value: "local_stock", labelEn: "Local stock", labelAr: "مخزون محلي" },
  { value: "import_only", labelEn: "Import only", labelAr: "استيراد فقط" },
  { value: "custom_fabrication", labelEn: "Custom fabrication", labelAr: "تصنيع حسب الطلب" },
  { value: "fast_delivery", labelEn: "Fast delivery", labelAr: "تسليم سريع" },
  { value: "technical_support", labelEn: "Technical support", labelAr: "دعم فني" },
  { value: "site_visit", labelEn: "Site visit available", labelAr: "زيارة موقع متاحة" },
  { value: "installation", labelEn: "Installation available", labelAr: "تنصيب متاح" },
  { value: "warranty", labelEn: "Warranty available", labelAr: "ضمان متاح" },
  { value: "cash_payment", labelEn: "Cash payment", labelAr: "دفع نقدي" },
  { value: "bank_transfer", labelEn: "Bank transfer", labelAr: "تحويل مصرفي" },
  { value: "usd_pricing", labelEn: "USD pricing", labelAr: "تسعير بالدولار" },
  { value: "iqd_pricing", labelEn: "IQD pricing", labelAr: "تسعير بالدينار" },
  { value: "official_invoice", labelEn: "Can issue official invoice", labelAr: "يصدر فاتورة رسمية" },
  { value: "company_profile", labelEn: "Has company profile", labelAr: "لديه بروفايل شركة" },
  { value: "project_experience", labelEn: "Has previous project experience", labelAr: "لديه خبرة مشاريع" },
  { value: "works_ngos", labelEn: "Works with NGOs", labelAr: "يتعامل مع المنظمات" },
  { value: "works_construction", labelEn: "Works with construction companies", labelAr: "يتعامل مع شركات إنشائية" },
  { value: "works_oil_gas", labelEn: "Works with oil and gas", labelAr: "يتعامل مع النفط والغاز" },
  { value: "works_power_plants", labelEn: "Works with power plants", labelAr: "يتعامل مع محطات الطاقة" },
];

export const sourceTypes: OptionItem[] = [
  { value: "purchased_before", labelEn: "I purchased from them before", labelAr: "اشتريت منهم سابقًا" },
  { value: "requested_quotation", labelEn: "I requested quotation from them before", labelAr: "طلبت منهم عرض سعر سابقًا" },
  { value: "trusted_recommendation", labelEn: "Recommended by trusted person", labelAr: "توصية من شخص موثوق" },
  { value: "market_visit", labelEn: "Found through market visit", labelAr: "من زيارة للسوق" },
  { value: "found_online", labelEn: "Found online", labelAr: "وجدته عبر الإنترنت" },
  { value: "known_market_supplier", labelEn: "Known supplier in the market", labelAr: "مجهز معروف في السوق" },
  { value: "other", labelEn: "Other", labelAr: "أخرى" },
] satisfies Array<OptionItem & { value: SourceType }>;

export const confidenceLevels: OptionItem[] = [
  { value: "high", labelEn: "High", labelAr: "عالية" },
  { value: "medium", labelEn: "Medium", labelAr: "متوسطة" },
  { value: "low", labelEn: "Low", labelAr: "منخفضة" },
  { value: "needs_verification", labelEn: "Needs verification", labelAr: "تحتاج تحقق" },
] satisfies Array<OptionItem & { value: ConfidenceLevel }>;

export const coverageAreas: OptionItem[] = [
  { value: "local_only", labelEn: "Local only", labelAr: "محلي فقط" },
  { value: "governorate_level", labelEn: "Governorate level", labelAr: "ضمن المحافظة" },
  { value: "all_iraq", labelEn: "All Iraq", labelAr: "كل العراق" },
  { value: "imports_outside_iraq", labelEn: "Imports from outside Iraq", labelAr: "يستورد من خارج العراق" },
];

export const paymentOptions: OptionItem[] = [
  { value: "cash", labelEn: "Cash", labelAr: "نقدًا" },
  { value: "bank_transfer", labelEn: "Bank transfer", labelAr: "تحويل مصرفي" },
  { value: "usd", labelEn: "USD", labelAr: "دولار" },
  { value: "iqd", labelEn: "IQD", labelAr: "دينار عراقي" },
  { value: "official_invoice", labelEn: "Official invoice", labelAr: "فاتورة رسمية" },
];

export const interactionTypes: OptionItem[] = [
  { value: "rfq_only", labelEn: "RFQ only", labelAr: "طلب سعر فقط" },
  { value: "purchase_order", labelEn: "Purchase order", labelAr: "أمر شراء" },
  { value: "delivery_completed", labelEn: "Delivery completed", labelAr: "تسليم مكتمل" },
  { value: "site_visit", labelEn: "Site visit", labelAr: "زيارة موقع" },
  { value: "market_inquiry", labelEn: "Market inquiry", labelAr: "استفسار سوقي" },
  { value: "contract", labelEn: "Contract", labelAr: "عقد" },
  { value: "after_sales_support", labelEn: "After-sales support", labelAr: "دعم بعد البيع" },
  { value: "other", labelEn: "Other", labelAr: "أخرى" },
];

export const positiveReviewTags: OptionItem[] = [
  { value: "fast_response", labelEn: "Fast response", labelAr: "استجابة سريعة" },
  { value: "good_price", labelEn: "Good price", labelAr: "سعر جيد" },
  { value: "professional", labelEn: "Professional", labelAr: "مهني" },
  { value: "clear_quotation", labelEn: "Clear quotation", labelAr: "عرض واضح" },
  { value: "delivered_on_time", labelEn: "Delivered on time", labelAr: "سلّم في الوقت" },
  { value: "good_quality", labelEn: "Good quality", labelAr: "جودة جيدة" },
  { value: "flexible_negotiation", labelEn: "Flexible negotiation", labelAr: "مرن بالتفاوض" },
  { value: "technical_knowledge", labelEn: "Good technical knowledge", labelAr: "معرفة فنية جيدة" },
  { value: "has_stock", labelEn: "Has stock", labelAr: "لديه مخزون" },
  { value: "good_documentation", labelEn: "Good documentation", labelAr: "توثيق جيد" },
  { value: "after_sales", labelEn: "Good after-sales support", labelAr: "دعم جيد بعد البيع" },
];

export const concernReviewTags: OptionItem[] = [
  { value: "slow_response", labelEn: "Slow response", labelAr: "استجابة بطيئة" },
  { value: "high_price", labelEn: "High price", labelAr: "سعر مرتفع" },
  { value: "delayed_delivery", labelEn: "Delayed delivery", labelAr: "تأخر بالتسليم" },
  { value: "unclear_quotation", labelEn: "Unclear quotation", labelAr: "عرض غير واضح" },
  { value: "needs_follow_up", labelEn: "Needs follow-up", labelAr: "يحتاج متابعة" },
  { value: "limited_stock", labelEn: "Limited stock", labelAr: "مخزون محدود" },
  { value: "weak_documentation", labelEn: "Weak documentation", labelAr: "توثيق ضعيف" },
  { value: "poor_communication", labelEn: "Poor communication", labelAr: "تواصل ضعيف" },
  { value: "changed_price", labelEn: "Changed price", labelAr: "غيّر السعر" },
  { value: "missed_specification", labelEn: "Did not meet specification", labelAr: "لم يطابق المواصفة" },
];

export const badgeDefinitions: OptionItem[] = [
  { value: "first_10_suppliers", labelEn: "First 10 Suppliers", labelAr: "أول 10 مجهزين" },
  { value: "approved_50_suppliers", labelEn: "50 Approved Suppliers", labelAr: "50 مجهز معتمد" },
  { value: "approved_100_suppliers", labelEn: "100 Approved Suppliers", labelAr: "100 مجهز معتمد" },
  { value: "trusted_contributor", labelEn: "Trusted Contributor", labelAr: "مساهم موثوق" },
  { value: "quality_contributor", labelEn: "Quality Contributor", labelAr: "مساهم نوعي" },
  { value: "review_contributor", labelEn: "Review Contributor", labelAr: "مساهم بالمراجعات" },
  { value: "duplicate_hunter", labelEn: "Duplicate Hunter", labelAr: "صياد التكرارات" },
  { value: "market_explorer", labelEn: "Market Explorer", labelAr: "مستكشف السوق" },
];

export function labelFor(options: OptionItem[], value: string, locale: "en" | "ar" = "en") {
  const option = options.find((item) => item.value === value);
  if (!option) {
    return value.replaceAll("_", " ");
  }
  return locale === "ar" ? option.labelAr : option.labelEn;
}
