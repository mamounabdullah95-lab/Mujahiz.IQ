import type { RegistrationSector } from "../types/workspace";

const labels: Array<[string, string, string]> = [
  ["oil_gas", "النفط والغاز", "Oil & gas"],
  ["power_energy", "الطاقة ومحطات الكهرباء", "Energy & power plants"],
  ["construction_infrastructure", "الإنشاءات والبنية التحتية", "Construction & infrastructure"],
  ["industry_manufacturing", "الصناعة والتصنيع", "Industry & manufacturing"],
  ["general_trade_distribution", "التجارة العامة والتوزيع", "General trade & distribution"],
  ["government_public", "الخدمات الحكومية والقطاع العام", "Government & public sector"],
  ["humanitarian_development", "المنظمات الإنسانية والتنموية", "Humanitarian & development organizations"],
  ["health_medical", "الصحة والمستلزمات الطبية", "Healthcare & medical supplies"],
  ["education_universities", "التعليم والجامعات", "Education & universities"],
  ["telecom_it", "الاتصالات وتقنية المعلومات", "Telecommunications & IT"],
  ["transport_logistics", "النقل والخدمات اللوجستية", "Transport & logistics"],
  ["agriculture_food", "الزراعة والأغذية", "Agriculture & food"],
  ["hospitality_restaurants", "الضيافة والمطاعم", "Hospitality & restaurants"],
  ["retail_wholesale", "التجزئة والجملة", "Retail & wholesale"],
  ["real_estate", "العقارات", "Real estate"],
  ["professional_consulting", "الخدمات المهنية والاستشارية", "Professional & consulting services"],
  ["other", "أخرى", "Other"],
];

export const defaultRegistrationSectors: RegistrationSector[] = labels.map(([value, labelAr, labelEn], index) => ({
  value,
  labelAr,
  labelEn,
  order: index + 1,
  active: true,
}));
