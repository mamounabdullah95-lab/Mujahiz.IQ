param(
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\templates")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function OleColor([string]$Hex) {
  $value = $Hex.TrimStart("#")
  $r = [Convert]::ToInt32($value.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($value.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($value.Substring(4, 2), 16)
  return $r + (256 * $g) + (65536 * $b)
}

$colors = @{
  Ink = OleColor "#14213D"
  River = OleColor "#1B6B93"
  Mint = OleColor "#2A9D8F"
  Amber = OleColor "#E9A227"
  Clay = OleColor "#B85C38"
  Slate = OleColor "#64748B"
  PaleBlue = OleColor "#EAF4F8"
  PaleMint = OleColor "#E9F6F4"
  PaleAmber = OleColor "#FFF7E5"
  PaleSlate = OleColor "#F1F5F9"
  White = OleColor "#FFFFFF"
  Border = OleColor "#CBD5E1"
}

$fields = @(
  [pscustomobject]@{ Key="nameOriginal"; Ar="اسم المجهز"; En="Supplier name"; Group="identity"; Required=$true; ExampleAr="شركة النبع للتجارة العامة"; ExampleEn="Al-Nabaa General Trading"; TypeAr="نص"; TypeEn="Text"; NoteAr="الاسم القانوني أو المعروف"; NoteEn="Legal or commonly known name" },
  [pscustomobject]@{ Key="displayName"; Ar="الاسم الظاهر"; En="Display name"; Group="identity"; Required=$false; ExampleAr="النبع"; ExampleEn="Al-Nabaa"; TypeAr="نص"; TypeEn="Text"; NoteAr="اسم مختصر يظهر في الدليل"; NoteEn="Short name shown in the directory" },
  [pscustomobject]@{ Key="nameLanguage"; Ar="لغة اسم الشركة"; En="Company name language"; Group="identity"; Required=$true; ExampleAr="mixed"; ExampleEn="mixed"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="arabic أو english أو mixed"; NoteEn="arabic, english, or mixed" },
  [pscustomobject]@{ Key="nameAr"; Ar="اسم الشركة بالعربية"; En="Arabic company name"; Group="identity"; Required=$false; ExampleAr="شركة النبع"; ExampleEn="شركة النبع"; TypeAr="نص عربي"; TypeEn="Arabic text"; NoteAr="يوصى بإكماله لتحسين العرض"; NoteEn="Recommended for bilingual display" },
  [pscustomobject]@{ Key="nameEn"; Ar="اسم الشركة بالإنكليزية"; En="English company name"; Group="identity"; Required=$false; ExampleAr="Al-Nabaa Company"; ExampleEn="Al-Nabaa Company"; TypeAr="نص إنكليزي"; TypeEn="English text"; NoteAr="يوصى بإكماله لتحسين العرض"; NoteEn="Recommended for bilingual display" },
  [pscustomobject]@{ Key="businessType"; Ar="نوع النشاط"; En="Business type"; Group="identity"; Required=$true; ExampleAr="authorized_distributor"; ExampleEn="authorized_distributor"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="اختر من ورقة الخيارات"; NoteEn="Select from the Options sheet" },
  [pscustomobject]@{ Key="shortDescription"; Ar="وصف مختصر"; En="Short description"; Group="identity"; Required=$false; ExampleAr="موزع معتمد للصمامات والتجهيزات الميكانيكية"; ExampleEn="Authorized distributor for valves and mechanical supplies"; TypeAr="نص مختصر"; TypeEn="Short text"; NoteAr="صف قدرات الشركة دون أسعار"; NoteEn="Describe capabilities without prices" },

  [pscustomobject]@{ Key="governorates"; Ar="المحافظات"; En="Governorates"; Group="location"; Required=$true; ExampleAr="baghdad,basra,erbil"; ExampleEn="baghdad,basra,erbil"; TypeAr="أكواد متعددة"; TypeEn="Multiple codes"; NoteAr="افصل بفاصلة إنكليزية"; NoteEn="Separate with an English comma" },
  [pscustomobject]@{ Key="city"; Ar="المدينة الرئيسية"; En="Main city"; Group="location"; Required=$true; ExampleAr="الرمادي"; ExampleEn="Ramadi"; TypeAr="نص"; TypeEn="Text"; NoteAr="المدينة الرئيسية للشركة"; NoteEn="Supplier's main city" },
  [pscustomobject]@{ Key="marketArea"; Ar="السوق أو المنطقة الرئيسية"; En="Main market or area"; Group="location"; Required=$true; ExampleAr="المنطقة الصناعية"; ExampleEn="Industrial Area"; TypeAr="نص"; TypeEn="Text"; NoteAr="اكتب المدينة أو المنطقة بوضوح"; NoteEn="Enter a clear city or market area" },
  [pscustomobject]@{ Key="address"; Ar="العنوان الكامل"; En="Full address"; Group="location"; Required=$false; ExampleAr="المنطقة الصناعية، شارع 20"; ExampleEn="Industrial Area, Street 20"; TypeAr="نص"; TypeEn="Text"; NoteAr="اختياري لكنه مفيد"; NoteEn="Optional but useful" },
  [pscustomobject]@{ Key="googleMapsLink"; Ar="رابط خرائط Google"; En="Google Maps link"; Group="location"; Required=$false; ExampleAr="https://maps.google.com/..."; ExampleEn="https://maps.google.com/..."; TypeAr="رابط"; TypeEn="URL"; NoteAr="رابط موقع الشركة أو الفرع الرئيسي"; NoteEn="Main office or branch location" },
  [pscustomobject]@{ Key="coverageAreas"; Ar="نطاقات التغطية"; En="Coverage areas"; Group="location"; Required=$false; ExampleAr="all_iraq,imports_outside_iraq"; ExampleEn="all_iraq,imports_outside_iraq"; TypeAr="أكواد متعددة"; TypeEn="Multiple codes"; NoteAr="افصل بفاصلة إنكليزية"; NoteEn="Separate with an English comma" },
  [pscustomobject]@{ Key="branches"; Ar="تفاصيل الفروع"; En="Branch details"; Group="location"; Required=$false; ExampleAr="baghdad | بغداد | الكرادة | شارع 20 | 07700000000"; ExampleEn="baghdad | Baghdad | Karrada | Street 20 | 07700000000"; TypeAr="محافظة | مدينة | منطقة | عنوان | هاتف"; TypeEn="Governorate | City | Area | Address | Phone"; NoteAr="كل فرع في سطر مستقل أو افصل الفروع بـ ;"; NoteEn="One branch per line or separate branches with ;" },

  [pscustomobject]@{ Key="primaryPhone"; Ar="الهاتف الأساسي"; En="Primary phone"; Group="contact"; Required=$true; ExampleAr="07700000000"; ExampleEn="07700000000"; TypeAr="رقم هاتف"; TypeEn="Phone number"; NoteAr="مطلوب هاتف أو بريد إلكتروني واحد على الأقل"; NoteEn="At least one phone or email is required" },
  [pscustomobject]@{ Key="secondaryPhone"; Ar="الهاتف الثاني"; En="Secondary phone"; Group="contact"; Required=$false; ExampleAr="07800000000"; ExampleEn="07800000000"; TypeAr="رقم هاتف"; TypeEn="Phone number"; NoteAr="اختياري"; NoteEn="Optional" },
  [pscustomobject]@{ Key="whatsappAvailable"; Ar="واتساب متاح"; En="WhatsApp available"; Group="contact"; Required=$true; ExampleAr="yes"; ExampleEn="yes"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="yes أو no أو unknown"; NoteEn="yes, no, or unknown" },
  [pscustomobject]@{ Key="email"; Ar="البريد الإلكتروني"; En="Email"; Group="contact"; Required=$false; ExampleAr="sales@example.com"; ExampleEn="sales@example.com"; TypeAr="بريد إلكتروني"; TypeEn="Email"; NoteAr="استخدم البريد المهني إن توفر"; NoteEn="Use a business email when available" },
  [pscustomobject]@{ Key="website"; Ar="الموقع الإلكتروني"; En="Website"; Group="contact"; Required=$false; ExampleAr="https://example.com"; ExampleEn="https://example.com"; TypeAr="رابط"; TypeEn="URL"; NoteAr="ابدأ بـ https://"; NoteEn="Start with https://" },
  [pscustomobject]@{ Key="facebook"; Ar="صفحة فيسبوك"; En="Facebook page"; Group="contact"; Required=$false; ExampleAr="https://facebook.com/..."; ExampleEn="https://facebook.com/..."; TypeAr="رابط"; TypeEn="URL"; NoteAr="اختياري"; NoteEn="Optional" },
  [pscustomobject]@{ Key="instagramLinkedin"; Ar="إنستغرام أو LinkedIn"; En="Instagram or LinkedIn"; Group="contact"; Required=$false; ExampleAr="https://linkedin.com/company/..."; ExampleEn="https://linkedin.com/company/..."; TypeAr="رابط"; TypeEn="URL"; NoteAr="اختياري"; NoteEn="Optional" },
  [pscustomobject]@{ Key="contactPerson"; Ar="مسؤول الاتصال"; En="Contact person"; Group="contact"; Required=$false; ExampleAr="أحمد علي"; ExampleEn="Ahmed Ali"; TypeAr="نص"; TypeEn="Text"; NoteAr="اسم الشخص المسؤول"; NoteEn="Primary contact name" },
  [pscustomobject]@{ Key="contactPersonRole"; Ar="صفة مسؤول الاتصال"; En="Contact role"; Group="contact"; Required=$false; ExampleAr="مهندس مبيعات"; ExampleEn="Sales Engineer"; TypeAr="نص"; TypeEn="Text"; NoteAr="المنصب أو القسم"; NoteEn="Job title or department" },

  [pscustomobject]@{ Key="mainCategories"; Ar="التصنيفات الرئيسية"; En="Main categories"; Group="classification"; Required=$true; ExampleAr="valves,mechanical_materials"; ExampleEn="valves,mechanical_materials"; TypeAr="أكواد متعددة"; TypeEn="Multiple codes"; NoteAr="افصل بفاصلة إنكليزية"; NoteEn="Separate with an English comma" },
  [pscustomobject]@{ Key="subcategories"; Ar="التصنيفات الفرعية"; En="Subcategories"; Group="classification"; Required=$false; ExampleAr="صمامات صناعية، مضخات"; ExampleEn="Industrial valves, pumps"; TypeAr="قائمة نصية"; TypeEn="Text list"; NoteAr="افصل بفاصلة"; NoteEn="Separate with a comma" },
  [pscustomobject]@{ Key="capabilityTags"; Ar="وسوم القدرات"; En="Capability tags"; Group="classification"; Required=$true; ExampleAr="local_stock,technical_support,works_oil_gas"; ExampleEn="local_stock,technical_support,works_oil_gas"; TypeAr="أكواد متعددة"; TypeEn="Multiple codes"; NoteAr="اختر من ورقة الخيارات"; NoteEn="Use codes from the Options sheet" },

  [pscustomobject]@{ Key="paymentOptions"; Ar="خيارات الدفع المقبولة"; En="Accepted payment options"; Group="payment"; Required=$false; ExampleAr="bank_transfer,official_invoice"; ExampleEn="bank_transfer,official_invoice"; TypeAr="أكواد متعددة"; TypeEn="Multiple codes"; NoteAr="لا يتضمن أسعاراً أو عروضاً"; NoteEn="No prices or quotations are required" },
  [pscustomobject]@{ Key="acceptsCredit"; Ar="يقبل الدفع الآجل"; En="Accepts credit payment"; Group="payment"; Required=$false; ExampleAr="yes"; ExampleEn="yes"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="yes أو no أو unknown"; NoteEn="yes, no, or unknown" },
  [pscustomobject]@{ Key="creditDays"; Ar="أيام الدفع الآجل"; En="Credit days"; Group="payment"; Required=$false; ExampleAr="30,60"; ExampleEn="30,60"; TypeAr="أرقام متعددة"; TypeEn="Multiple numbers"; NoteAr="افصل بفاصلة إنكليزية"; NoteEn="Separate with an English comma" },
  [pscustomobject]@{ Key="creditStart"; Ar="بداية مدة الدفع الآجل"; En="Credit period starts"; Group="payment"; Required=$false; ExampleAr="invoice_date"; ExampleEn="invoice_date"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="من ورقة الخيارات"; NoteEn="Use a code from Options" },
  [pscustomobject]@{ Key="creditTermsNote"; Ar="ملاحظات الدفع الآجل"; En="Credit terms note"; Group="payment"; Required=$false; ExampleAr="يخضع لموافقة الشركة"; ExampleEn="Subject to company approval"; TypeAr="نص"; TypeEn="Text"; NoteAr="اختياري"; NoteEn="Optional" },

  [pscustomobject]@{ Key="sourceType"; Ar="مصدر المعلومات"; En="Source of information"; Group="source"; Required=$true; ExampleAr="purchased_before"; ExampleEn="purchased_before"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="كيف تعرف هذا المجهز؟"; NoteEn="How do you know this supplier?" },
  [pscustomobject]@{ Key="confidenceLevel"; Ar="مستوى الثقة"; En="Confidence level"; Group="source"; Required=$true; ExampleAr="high"; ExampleEn="high"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="قيّم موثوقية المعلومات"; NoteEn="Rate the reliability of the information" },
  [pscustomobject]@{ Key="hasDirectExperience"; Ar="خبرة مباشرة سابقة"; En="Previous direct experience"; Group="source"; Required=$true; ExampleAr="yes"; ExampleEn="yes"; TypeAr="كود واحد"; TypeEn="Single code"; NoteAr="yes أو no أو not_sure"; NoteEn="yes, no, or not_sure" },
  [pscustomobject]@{ Key="lastInteractionYear"; Ar="سنة آخر تعامل"; En="Last interaction year"; Group="source"; Required=$false; ExampleAr="2026"; ExampleEn="2026"; TypeAr="سنة"; TypeEn="Year"; NoteAr="أربع خانات"; NoteEn="Four digits" },
  [pscustomobject]@{ Key="relatedMaterialService"; Ar="التصنيف أو الخدمة المرتبطة"; En="Related category or service"; Group="source"; Required=$false; ExampleAr="صمامات وتجهيزات ميكانيكية"; ExampleEn="Valves and mechanical supplies"; TypeAr="نص مختصر"; TypeEn="Short text"; NoteAr="وصف عام، دون تفاصيل مادة"; NoteEn="General description, not item-level detail" },
  [pscustomobject]@{ Key="sourceNote"; Ar="ملاحظة المصدر"; En="Source note"; Group="source"; Required=$false; ExampleAr="تم التعامل معهم في مشروع طاقة"; ExampleEn="Used previously on a power project"; TypeAr="نص"; TypeEn="Text"; NoteAr="لا تكتب معلومات سرية"; NoteEn="Do not include confidential information" }
)

$options = @(
  @("company_name_language","arabic","Arabic","عربي"), @("company_name_language","english","English","إنكليزي"), @("company_name_language","mixed","Mixed","مختلط"),
  @("business_type","company","Company","شركة"), @("business_type","office","Office","مكتب"), @("business_type","workshop","Workshop","ورشة"), @("business_type","factory","Factory","معمل"), @("business_type","trader","Trader","تاجر"), @("business_type","authorized_distributor","Authorized distributor","موزّع معتمد"), @("business_type","importer","Importer","مستورد"), @("business_type","service_provider","Service provider","مقدّم خدمات"), @("business_type","individual_supplier","Individual supplier","مجهز فردي"), @("business_type","other","Other","أخرى"),
  @("governorate","baghdad","Baghdad","بغداد"), @("governorate","basra","Basra","البصرة"), @("governorate","nineveh","Nineveh","نينوى"), @("governorate","erbil","Erbil","أربيل"), @("governorate","sulaymaniyah","Sulaymaniyah","السليمانية"), @("governorate","duhok","Duhok","دهوك"), @("governorate","kirkuk","Kirkuk","كركوك"), @("governorate","najaf","Najaf","النجف"), @("governorate","karbala","Karbala","كربلاء"), @("governorate","babil","Babil","بابل"), @("governorate","wasit","Wasit","واسط"), @("governorate","diyala","Diyala","ديالى"), @("governorate","anbar","Anbar","الأنبار"), @("governorate","salah_al_din","Salah al-Din","صلاح الدين"), @("governorate","dhi_qar","Dhi Qar","ذي قار"), @("governorate","maysan","Maysan","ميسان"), @("governorate","muthanna","Muthanna","المثنى"), @("governorate","qadisiyyah","Qadisiyyah","القادسية"),
  @("coverage_area","local_only","Local only","محلي فقط"), @("coverage_area","governorate_level","Governorate level","ضمن المحافظة"), @("coverage_area","all_iraq","All Iraq","كل العراق"), @("coverage_area","imports_outside_iraq","Imports from outside Iraq","يستورد من خارج العراق"),
  @("yes_no_unknown","yes","Yes","نعم"), @("yes_no_unknown","no","No","لا"), @("yes_no_unknown","unknown","Unknown","غير معروف"),
  @("supplier_category","electrical_materials","Electrical materials","مواد كهربائية"), @("supplier_category","mechanical_materials","Mechanical materials","مواد ميكانيكية"), @("supplier_category","piping_materials","Piping materials","مواد الأنابيب"), @("supplier_category","flanges_fittings","Flanges and fittings","الفلنجات وملحقات الأنابيب"), @("supplier_category","valves","Valves","صمامات"), @("supplier_category","instrumentation","Instrumentation","أجهزة القياس والتحكم"), @("supplier_category","civil_construction","Civil and construction materials","مواد إنشائية ومدنية"), @("supplier_category","steel_fabrication","Steel and fabrication","الأعمال المعدنية والتصنيع الهندسي"), @("supplier_category","welding_machining","Welding and machining","اللحام والتشغيل الميكانيكي"), @("supplier_category","safety_ppe","Safety and PPE","معدات السلامة والوقاية الشخصية"), @("supplier_category","tools_equipment","Tools and equipment","أدوات ومعدات"), @("supplier_category","heavy_equipment_rental","Heavy equipment rental","تأجير معدات ثقيلة"), @("supplier_category","transport_logistics","Transportation and logistics","النقل والخدمات اللوجستية"), @("supplier_category","office_supplies","Office supplies","مستلزمات مكتبية"), @("supplier_category","it_electronics","IT and electronics","تقنية المعلومات والإلكترونيات"), @("supplier_category","furniture","Furniture","أثاث"), @("supplier_category","chemicals","Chemicals","مواد كيميائية"), @("supplier_category","oil_gas_materials","Oil and gas materials","مواد النفط والغاز"), @("supplier_category","power_plant_materials","Power plant materials","مواد محطات الطاقة"), @("supplier_category","general_trading","General trading","تجارة عامة"), @("supplier_category","maintenance_services","Maintenance services","خدمات صيانة"), @("supplier_category","printing_advertising","Printing and advertising","طباعة وإعلان"), @("supplier_category","other","Other","أخرى"),
  @("capability_tag","local_stock","Local stock","مخزون محلي"), @("capability_tag","import_only","Import only","استيراد فقط"), @("capability_tag","custom_fabrication","Custom fabrication","تصنيع حسب الطلب"), @("capability_tag","fast_delivery","Fast delivery","تسليم سريع"), @("capability_tag","technical_support","Technical support","دعم فني"), @("capability_tag","site_visit","Site visit available","زيارة موقع متاحة"), @("capability_tag","installation","Installation available","تنصيب متاح"), @("capability_tag","warranty","Warranty available","ضمان متاح"), @("capability_tag","company_profile","Has company profile","لديه ملف تعريفي للشركة"), @("capability_tag","project_experience","Has previous project experience","لديه خبرة سابقة في المشاريع"), @("capability_tag","obsolete_items","Can source obsolete items","يوفر المواد المتوقفة أو النادرة"), @("capability_tag","repair_overhaul","Repair and overhaul","إصلاح وإعادة تأهيل"), @("capability_tag","emergency_sourcing","Emergency sourcing","تجهيز الحالات الطارئة"), @("capability_tag","works_ngos","Works with NGOs","يتعامل مع المنظمات"), @("capability_tag","works_construction","Works with construction companies","يتعامل مع شركات إنشائية"), @("capability_tag","works_oil_gas","Works with oil and gas","يتعامل مع النفط والغاز"), @("capability_tag","works_power_plants","Works with power plants","يتعامل مع محطات الطاقة"), @("capability_tag","official_invoice","Can issue official invoice","يصدر فاتورة رسمية"),
  @("payment_option","cash","Cash","نقدًا"), @("payment_option","bank_transfer","Bank transfer","تحويل مصرفي"), @("payment_option","usd","USD","دولار"), @("payment_option","iqd","IQD","دينار عراقي"), @("payment_option","official_invoice","Official invoice","فاتورة رسمية"),
  @("credit_start","invoice_date","From invoice date","من تاريخ الفاتورة"), @("credit_start","delivery_date","From delivery date","من تاريخ الاستلام"), @("credit_start","invoice_approval","From invoice approval","من تاريخ اعتماد الفاتورة"),
  @("source_type","purchased_before","I purchased from them before","اشتريت منهم سابقًا"), @("source_type","requested_quotation","I requested quotation from them before","طلبت منهم عرض سعر سابقًا"), @("source_type","trusted_recommendation","Recommended by trusted person","توصية من شخص موثوق"), @("source_type","market_visit","Found through market visit","من زيارة للسوق"), @("source_type","found_online","Found online","وجدته عبر الإنترنت"), @("source_type","known_market_supplier","Known supplier in the market","مجهز معروف في السوق"), @("source_type","other","Other","أخرى"),
  @("confidence_level","high","High","عالية"), @("confidence_level","medium","Medium","متوسطة"), @("confidence_level","low","Low","منخفضة"), @("confidence_level","needs_verification","Needs verification","تحتاج تحقق"),
  @("direct_experience","yes","Yes","نعم"), @("direct_experience","no","No","لا"), @("direct_experience","not_sure","Not sure","غير متأكد")
)

$groupColors = @{
  identity = $colors.Ink
  location = $colors.River
  contact = $colors.Mint
  classification = $colors.Slate
  payment = $colors.Amber
  source = $colors.Clay
}

$validationNames = @{
  nameLanguage = "CompanyNameLanguageCodes"
  businessType = "BusinessTypeCodes"
  whatsappAvailable = "YesNoUnknownCodes"
  acceptsCredit = "YesNoUnknownCodes"
  creditStart = "CreditStartCodes"
  sourceType = "SourceTypeCodes"
  confidenceLevel = "ConfidenceLevelCodes"
  hasDirectExperience = "DirectExperienceCodes"
}

function Apply-Borders($range) {
  $range.Borders.Color = $colors.Border
  $range.Borders.Weight = 2
}

function Add-ListValidation($range, [string]$Name) {
  $range.Validation.Delete()
  $range.Validation.Add(3, 1, 1, "=$Name")
  $range.Validation.IgnoreBlank = $true
  $range.Validation.InCellDropdown = $true
  $range.Validation.ShowError = $true
  $range.Validation.ErrorTitle = "Invalid value"
  $range.Validation.ErrorMessage = "Select a value from the list."
}

function Add-YearValidation($range) {
  $range.Validation.Delete()
  $range.Validation.Add(1, 1, 1, 2000, 2100)
  $range.Validation.IgnoreBlank = $true
  $range.Validation.ShowError = $true
}

function Write-OptionsSheet($workbook, $sheet, [bool]$Arabic) {
  $sheet.Cells.Clear()
  $sheet.DisplayRightToLeft = $Arabic
  $sheet.Range("A1:D1").Merge()
  $sheet.Range("A1").Value2 = if ($Arabic) { "قائمة الأكواد المقبولة" } else { "Accepted Codes" }
  $sheet.Range("A1").Interior.Color = $colors.Ink
  $sheet.Range("A1").Font.Color = $colors.White
  $sheet.Range("A1").Font.Bold = $true
  $sheet.Range("A1").Font.Size = 16
  $sheet.Range("A1").HorizontalAlignment = -4108
  $sheet.Range("A2:D2").Merge()
  $sheet.Range("A2").Value2 = if ($Arabic) {
    "استخدم Code داخل نموذج الرفع. الحقول متعددة الاختيار تقبل أكثر من كود مفصولاً بفاصلة إنكليزية (,)."
  } else {
    "Use Code values in the import form. Multi-select fields accept multiple codes separated by an English comma (,)."
  }
  $sheet.Range("A2").WrapText = $true
  $headers = @("Group", "Code", "English Label", "Arabic Label")
  for ($c = 1; $c -le 4; $c++) { $sheet.Cells.Item(3, $c).Value2 = $headers[$c - 1] }
  $sheet.Range("A3:D3").Interior.Color = $colors.River
  $sheet.Range("A3:D3").Font.Color = $colors.White
  $sheet.Range("A3:D3").Font.Bold = $true

  $ranges = @{}
  $row = 4
  foreach ($option in $options) {
    for ($c = 1; $c -le 4; $c++) { $sheet.Cells.Item($row, $c).Value2 = $option[$c - 1] }
    if (-not $ranges.ContainsKey($option[0])) {
      $ranges[$option[0]] = [pscustomobject]@{ Start=$row; End=$row }
    } else {
      $ranges[$option[0]].End = $row
    }
    $row += 1
  }

  $sheet.Range("A4:D$($row - 1)").Font.Size = 10
  $sheet.Range("A3:D$($row - 1)").VerticalAlignment = -4108
  Apply-Borders $sheet.Range("A3:D$($row - 1)")
  $sheet.Columns.Item(1).ColumnWidth = 24
  $sheet.Columns.Item(2).ColumnWidth = 28
  $sheet.Columns.Item(3).ColumnWidth = 38
  $sheet.Columns.Item(4).ColumnWidth = 38
  $sheet.Rows.Item(1).RowHeight = 28
  $sheet.Rows.Item(2).RowHeight = 38
  $sheet.Range("A1:D$($row - 1)").WrapText = $true
  $sheet.Activate()
  $workbook.Application.ActiveWindow.SplitRow = 3
  $workbook.Application.ActiveWindow.FreezePanes = $true

  $nameMap = @{
    company_name_language = "CompanyNameLanguageCodes"
    business_type = "BusinessTypeCodes"
    yes_no_unknown = "YesNoUnknownCodes"
    credit_start = "CreditStartCodes"
    source_type = "SourceTypeCodes"
    confidence_level = "ConfidenceLevelCodes"
    direct_experience = "DirectExperienceCodes"
  }
  foreach ($group in $nameMap.Keys) {
    $range = $ranges[$group]
    $formula = "='$($sheet.Name)'!`$B`$$($range.Start):`$B`$$($range.End)"
    $workbook.Names.Add($nameMap[$group], $formula) | Out-Null
  }
}

function Write-GuideSheet($sheet, [bool]$Arabic, [bool]$Bulk) {
  $sheet.Cells.Clear()
  $sheet.DisplayRightToLeft = $Arabic
  $sheet.Range("A1:E1").Merge()
  $sheet.Range("A1").Value2 = if ($Arabic) { "دليل تعبئة نموذج مجهز IQ" } else { "Mujahiz IQ Supplier Import Guide" }
  $sheet.Range("A1").Interior.Color = $colors.Ink
  $sheet.Range("A1").Font.Color = $colors.White
  $sheet.Range("A1").Font.Bold = $true
  $sheet.Range("A1").Font.Size = 17
  $sheet.Range("A1").HorizontalAlignment = -4108
  $sheet.Range("A2:E2").Merge()
  $sheet.Range("A2").Value2 = if ($Arabic) {
    "هذه الورقة للتوضيح فقط. لا تغيّر أسماء الحقول في ورقة Supplier Form. يمكن استخدام الكود أو التسمية العربية أو الإنكليزية، لكن الأكواد أدق."
  } else {
    "This sheet is for guidance only. Do not rename fields in Supplier Form. Codes or Arabic/English labels are accepted, but codes are the most reliable."
  }
  $sheet.Range("A2").WrapText = $true

  $sheet.Range("A4:E4").Merge()
  $sheet.Range("A4").Value2 = if ($Arabic) { "تعليمات مختصرة" } else { "Quick instructions" }
  $sheet.Range("A4").Interior.Color = $colors.River
  $sheet.Range("A4").Font.Color = $colors.White
  $sheet.Range("A4").Font.Bold = $true

  $instructionsAr = @(
    "اكتب القيم داخل ورقة Supplier Form فقط.",
    $(if ($Bulk) { "املأ الصفوف من 2 إلى 51، وكل صف يمثل مجهزاً واحداً." } else { "املأ عمود القيمة فقط، وكل الملف يمثل مجهزاً واحداً." }),
    "الحقول التي تحمل علامة * مطلوبة لإرسال المجهز دون تعديل.",
    "في الحقول متعددة الاختيار افصل القيم بفاصلة إنكليزية (,).",
    "في تفاصيل الفروع استخدم: المحافظة | المدينة | المنطقة | العنوان | الهاتف، وكل فرع في سطر مستقل.",
    "لا تضف أسعاراً أو عروضاً؛ المطلوب هو قدرات وتصنيفات المجهز."
  )
  $instructionsEn = @(
    "Enter values only in the Supplier Form sheet.",
    $(if ($Bulk) { "Fill rows 2 to 51; each row represents one supplier." } else { "Fill the Value column only; the file represents one supplier." }),
    "Fields marked with * are required for submission without correction.",
    "Separate multiple values with an English comma (,).",
    "For branches use: governorate | city | area | address | phone, one branch per line.",
    "Do not add prices or quotations; the form captures supplier categories and capabilities."
  )
  $instructions = if ($Arabic) { $instructionsAr } else { $instructionsEn }
  for ($index = 0; $index -lt $instructions.Count; $index++) {
    $sheet.Cells.Item(5 + $index, 1).Value2 = [string]($index + 1)
    $sheet.Range("B$(5 + $index):E$(5 + $index)").Merge()
    $sheet.Cells.Item(5 + $index, 2).Value2 = $instructions[$index]
  }

  $headerRow = 12
  $guideHeaders = if ($Arabic) {
    @("الحقل", "الأهمية", "مثال صحيح", "نوع الإجابة / القيم المقبولة", "ملاحظة")
  } else {
    @("Field", "Importance", "Correct example", "Answer type / accepted values", "Note")
  }
  for ($c = 1; $c -le 5; $c++) { $sheet.Cells.Item($headerRow, $c).Value2 = $guideHeaders[$c - 1] }
  $sheet.Range("A$headerRow:E$headerRow").Interior.Color = $colors.River
  $sheet.Range("A$headerRow:E$headerRow").Font.Color = $colors.White
  $sheet.Range("A$headerRow:E$headerRow").Font.Bold = $true

  $row = $headerRow + 1
  foreach ($field in $fields) {
    $sheet.Cells.Item($row, 1).Value2 = if ($Arabic) { $field.Ar } else { $field.En }
    $sheet.Cells.Item($row, 2).Value2 = if ($field.Required) {
      if ($Arabic) { "مطلوب" } else { "Required" }
    } else {
      if ($Arabic) { "اختياري" } else { "Optional" }
    }
    $sheet.Cells.Item($row, 3).Value2 = if ($Arabic) { $field.ExampleAr } else { $field.ExampleEn }
    $sheet.Cells.Item($row, 4).Value2 = if ($Arabic) { $field.TypeAr } else { $field.TypeEn }
    $sheet.Cells.Item($row, 5).Value2 = if ($Arabic) { $field.NoteAr } else { $field.NoteEn }
    if ($field.Required) {
      $sheet.Cells.Item($row, 2).Interior.Color = $colors.PaleAmber
      $sheet.Cells.Item($row, 2).Font.Color = $colors.Clay
      $sheet.Cells.Item($row, 2).Font.Bold = $true
    }
    $row += 1
  }

  $sheet.Range("A$headerRow:E$($row - 1)").WrapText = $true
  $sheet.Range("A$headerRow:E$($row - 1)").VerticalAlignment = -4108
  Apply-Borders $sheet.Range("A$headerRow:E$($row - 1)")
  $sheet.Columns.Item(1).ColumnWidth = 27
  $sheet.Columns.Item(2).ColumnWidth = 13
  $sheet.Columns.Item(3).ColumnWidth = 42
  $sheet.Columns.Item(4).ColumnWidth = 38
  $sheet.Columns.Item(5).ColumnWidth = 48
  $sheet.Rows.Item(1).RowHeight = 30
  $sheet.Rows.Item(2).RowHeight = 42
  $sheet.Activate()
  $sheet.Application.ActiveWindow.SplitRow = 12
  $sheet.Application.ActiveWindow.FreezePanes = $true
}

function Write-SupplierForm($workbook, $sheet, [bool]$Arabic, [bool]$Bulk) {
  $sheet.Cells.Clear()
  $sheet.DisplayRightToLeft = $Arabic
  $sheet.Tab.Color = $colors.River

  if ($Bulk) {
    for ($c = 1; $c -le $fields.Count; $c++) {
      $field = $fields[$c - 1]
      $label = if ($Arabic) { "$($field.Ar) / $($field.En.ToLower())" } else { $field.En }
      if ($field.Required) { $label = "* $label" }
      $sheet.Cells.Item(1, $c).Value2 = $label
      $sheet.Cells.Item(1, $c).Interior.Color = $groupColors[$field.Group]
      $sheet.Cells.Item(1, $c).Font.Color = $colors.White
      $sheet.Cells.Item(1, $c).Font.Bold = $true
      $sheet.Cells.Item(1, $c).HorizontalAlignment = -4108
      $sheet.Cells.Item(1, $c).VerticalAlignment = -4108
      $sheet.Cells.Item(1, $c).WrapText = $true
      $sheet.Columns.Item($c).ColumnWidth = if ($field.Key -in @("shortDescription","address","branches","creditTermsNote","sourceNote")) { 32 } elseif ($field.Key -in @("mainCategories","capabilityTags","paymentOptions","subcategories")) { 27 } else { 20 }
      if ($validationNames.ContainsKey($field.Key)) {
        Add-ListValidation $sheet.Range($sheet.Cells.Item(2, $c), $sheet.Cells.Item(51, $c)) $validationNames[$field.Key]
      }
      if ($field.Key -eq "lastInteractionYear") {
        Add-YearValidation $sheet.Range($sheet.Cells.Item(2, $c), $sheet.Cells.Item(51, $c))
      }
    }
    $sheet.Rows.Item(1).RowHeight = 62
    $dataRange = $sheet.Range($sheet.Cells.Item(2, 1), $sheet.Cells.Item(51, $fields.Count))
    $dataRange.NumberFormat = "@"
    $dataRange.VerticalAlignment = -4108
    $dataRange.WrapText = $true
    for ($row = 2; $row -le 51; $row++) {
      if ($row % 2 -eq 0) {
        $sheet.Range($sheet.Cells.Item($row, 1), $sheet.Cells.Item($row, $fields.Count)).Interior.Color = $colors.PaleSlate
      }
      $sheet.Rows.Item($row).RowHeight = 30
    }
    Apply-Borders $sheet.Range($sheet.Cells.Item(1, 1), $sheet.Cells.Item(51, $fields.Count))
    $sheet.Range($sheet.Cells.Item(1, 1), $sheet.Cells.Item(51, $fields.Count)).AutoFilter() | Out-Null
    $sheet.Activate()
    $workbook.Application.ActiveWindow.SplitRow = 1
    $workbook.Application.ActiveWindow.SplitColumn = 2
    $workbook.Application.ActiveWindow.FreezePanes = $true
  } else {
    $sheet.Cells.Item(1, 1).Value2 = if ($Arabic) { "الحقل / Field" } else { "Field" }
    $sheet.Cells.Item(1, 2).Value2 = if ($Arabic) { "القيمة / Value" } else { "Value" }
    $sheet.Range("A1:B1").Interior.Color = $colors.Ink
    $sheet.Range("A1:B1").Font.Color = $colors.White
    $sheet.Range("A1:B1").Font.Bold = $true
    $sheet.Range("A1:B1").HorizontalAlignment = -4108
    $sheet.Rows.Item(1).RowHeight = 28

    for ($index = 0; $index -lt $fields.Count; $index++) {
      $row = $index + 2
      $field = $fields[$index]
      $label = if ($Arabic) { "$($field.Ar) / $($field.En)" } else { $field.En }
      if ($field.Required) { $label = "* $label" }
      $sheet.Cells.Item($row, 1).Value2 = $label
      $sheet.Cells.Item($row, 1).Interior.Color = $groupColors[$field.Group]
      $sheet.Cells.Item($row, 1).Font.Color = $colors.White
      $sheet.Cells.Item($row, 1).Font.Bold = $true
      $sheet.Cells.Item($row, 2).Interior.Color = if ($field.Required) { $colors.PaleAmber } else { $colors.PaleBlue }
      $sheet.Cells.Item($row, 2).NumberFormat = "@"
      $sheet.Cells.Item($row, 2).WrapText = $true
      if ($validationNames.ContainsKey($field.Key)) {
        Add-ListValidation $sheet.Cells.Item($row, 2) $validationNames[$field.Key]
      }
      if ($field.Key -eq "lastInteractionYear") {
        Add-YearValidation $sheet.Cells.Item($row, 2)
      }
      $sheet.Rows.Item($row).RowHeight = if ($field.Key -eq "branches") { 58 } else { 30 }
    }
    $sheet.Columns.Item(1).ColumnWidth = 44
    $sheet.Columns.Item(2).ColumnWidth = 68
    $sheet.Range("A1:B$($fields.Count + 1)").VerticalAlignment = -4108
    Apply-Borders $sheet.Range("A1:B$($fields.Count + 1)")
    $sheet.Activate()
    $workbook.Application.ActiveWindow.SplitRow = 1
    $workbook.Application.ActiveWindow.SplitColumn = 1
    $workbook.Application.ActiveWindow.FreezePanes = $true
  }

  $sheet.Cells.Font.Name = "Arial"
  $sheet.Cells.Font.Size = 10
  $sheet.PageSetup.Orientation = 2
  $sheet.PageSetup.Zoom = $false
  $sheet.PageSetup.FitToPagesWide = 1
}

function New-Template([bool]$Arabic, [bool]$Bulk, [string]$FileName) {
  $workbook = $excel.Workbooks.Add()
  while ($workbook.Worksheets.Count -lt 3) { $workbook.Worksheets.Add() | Out-Null }
  while ($workbook.Worksheets.Count -gt 3) { $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete() }

  $formSheet = $workbook.Worksheets.Item(1)
  $guideSheet = $workbook.Worksheets.Item(2)
  $optionsSheet = $workbook.Worksheets.Item(3)
  $formSheet.Name = "Supplier Form"
  $guideSheet.Name = if ($Arabic) { "دليل الاستخدام" } else { "Guide" }
  $optionsSheet.Name = if ($Arabic) { "الخيارات" } else { "Options" }

  Write-OptionsSheet $workbook $optionsSheet $Arabic
  Write-GuideSheet $guideSheet $Arabic $Bulk
  Write-SupplierForm $workbook $formSheet $Arabic $Bulk
  $formSheet.Activate()

  $path = Join-Path $OutputDirectory $FileName
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  $workbook.SaveAs($path, 51)
  $workbook.Close($false)
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($optionsSheet) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($guideSheet) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($formSheet) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  New-Template $true $false "supplier-single-template-ar.xlsx"
  New-Template $false $false "supplier-single-template-en.xlsx"
  New-Template $true $true "supplier-bulk-template-ar.xlsx"
  New-Template $false $true "supplier-bulk-template-en.xlsx"
} finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

Get-ChildItem -LiteralPath $OutputDirectory -Filter "supplier-*-template-*.xlsx" |
  Sort-Object Name |
  ForEach-Object { Write-Output "$($_.Name)|$($_.Length)" }
