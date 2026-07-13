export type LocalizedText = { ar: string; en: string };

export type PublicContentSection = {
  title: LocalizedText;
  body: LocalizedText;
};

export type PublicContentPage = {
  key: string;
  slug: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  metaTitle: LocalizedText;
  metaDescription: LocalizedText;
  cta: LocalizedText;
  sections: PublicContentSection[];
};

export const publicPages = {
  "about": {
    "key": "about",
    "slug": "/about",
    "title": {
      "ar": "عن مجهز",
      "en": "About Mujahiz IQ"
    },
    "subtitle": {
      "ar": "منصة عراقية ذكية تجعل الوصول إلى المجهزين، المعلومات، وتجارب السوق أكثر سهولة ووضوحاً.",
      "en": "An Iraq-focused smart platform that makes supplier discovery, market information, and procurement experience sharing easier and clearer."
    },
    "metaTitle": {
      "ar": "عن منصة مجهز | شبكة المجهزين والمشتريات في العراق",
      "en": "About Mujahiz IQ | Iraq Supplier and Procurement Network"
    },
    "metaDescription": {
      "ar": "تعرف على منصة مجهز، مساحة رقمية مهنية تربط فرق المشتريات بالمجهزين الموثوقين وتدعم قرارات شراء أوضح وأكثر كفاءة.",
      "en": "Learn about Mujahiz IQ, a professional digital workspace connecting procurement teams with trusted suppliers and supporting clearer, more efficient purchasing decisions."
    },
    "cta": {
      "ar": "ابدأ من مجهز للوصول إلى خيارات أوضح وقرارات شراء أفضل.",
      "en": "Start with Mujahiz IQ to reach clearer options and better purchasing decisions."
    },
    "sections": [
      {
        "title": {
          "ar": "من نحن",
          "en": "Who We Are"
        },
        "body": {
          "ar": "مجهز هي منصة رقمية مهنية مصممة للعاملين في المشتريات وسلسلة التوريد داخل العراق. تجمع المنصة بين دليل منظم للمجهزين، أدوات بحث وفرز، ومساحة معرفية تساعد فرق المشتريات على الوصول إلى معلومات أوضح قبل اتخاذ القرار.",
          "en": "Mujahiz IQ is a professional digital platform designed for procurement and supply chain professionals in Iraq. It combines an organized supplier directory, search and filtering tools, and a shared knowledge space that helps procurement teams access clearer information before making decisions."
        }
      },
      {
        "title": {
          "ar": "المشكلة التي نعالجها",
          "en": "The Problem We Address"
        },
        "body": {
          "ar": "كثير من عمليات الشراء تبدأ ببحث عشوائي، اتصالات متفرقة، معلومات غير مكتملة، وتجارب سوق غير موثقة. هذه الفجوة تؤدي إلى ضياع الوقت، ضعف المقارنة، تكرار الأخطاء، وصعوبة الوصول إلى مجهزين مناسبين بسرعة.",
          "en": "Many purchasing processes begin with random searching, scattered phone calls, incomplete information, and undocumented market experiences. This gap wastes time, weakens comparison, repeats mistakes, and makes it difficult to reach suitable suppliers quickly."
        }
      },
      {
        "title": {
          "ar": "ما الذي يميز مجهز؟",
          "en": "What Makes Mujahiz Different?"
        },
        "body": {
          "ar": "مجهز ليست مجرد قائمة أسماء وأرقام. هي بيئة عمل ذكية تساعد على تنظيم بيانات المجهزين، تسهيل البحث، توثيق التجارب، وبناء معرفة مشتركة قابلة للبحث تخدم المشترين والمجهزين معاً.",
          "en": "Mujahiz IQ is not just a list of names and phone numbers. It is a smart workspace that helps organize supplier data, simplify discovery, document experiences, and build searchable shared knowledge for both buyers and suppliers."
        }
      },
      {
        "title": {
          "ar": "رؤيتنا",
          "en": "Our Vision"
        },
        "body": {
          "ar": "أن تصبح مجهز نقطة البداية الموثوقة لأي عملية بحث عن مجهز أو معلومة سوقية في العراق، وأن تساهم في رفع كفاءة المشتريات وتقليل الهدر في الوقت والتكاليف.",
          "en": "To make Mujahiz IQ the trusted starting point for supplier discovery and market information in Iraq, while contributing to more efficient procurement and reduced waste in time and cost."
        }
      },
      {
        "title": {
          "ar": "رسالتنا",
          "en": "Our Mission"
        },
        "body": {
          "ar": "تمكين فرق المشتريات والمجهزين من العمل بوضوح واحترافية عبر منصة تجمع البيانات، الثقة، التجارب، وسهولة الوصول في مكان واحد.",
          "en": "To enable procurement teams and suppliers to work with clarity and professionalism through a platform that brings together data, trust, experience, and accessibility in one place."
        }
      }
    ]
  },
  "suppliers": {
    "key": "suppliers",
    "slug": "/suppliers",
    "title": {
      "ar": "انضم كمجهز وكن أقرب إلى طلبات الشراء الجادة",
      "en": "Join as a Supplier and Get Closer to Serious Purchasing Requests"
    },
    "subtitle": {
      "ar": "اعرض خدماتك ومنتجاتك بشكل منظم، وكن ضمن شبكة مهنية يبحث فيها المشترون عن مجهزين موثوقين.",
      "en": "Present your products and services in an organized way and become part of a professional network where buyers search for trusted suppliers."
    },
    "metaTitle": {
      "ar": "المجهزون | فرص ظهور أكبر أمام فرق المشتريات",
      "en": "Suppliers | More Visibility for Procurement Opportunities"
    },
    "metaDescription": {
      "ar": "صفحة مخصصة للمجهزين لشرح فوائد الانضمام إلى منصة مجهز، وكيف تساعدهم على الوصول إلى فرص جادة وبناء حضور مهني موثوق.",
      "en": "A page for suppliers explaining the benefits of joining Mujahiz IQ and how it helps them reach serious opportunities and build trusted professional visibility."
    },
    "cta": {
      "ar": "قدّم طلب الانضمام الآن واجعل ملفك جاهزاً للظهور أمام المشترين.",
      "en": "Submit your join request now and prepare your profile to appear in front of buyers."
    },
    "sections": [
      {
        "title": {
          "ar": "لماذا تنضم كمجهز؟",
          "en": "Why Join as a Supplier?"
        },
        "body": {
          "ar": "الانضمام إلى مجهز يمنحك حضوراً رقمياً منظماً أمام الشركات والمؤسسات التي تبحث عن مجهزين حسب التخصص، الموقع، المنتجات، والخدمات. بدلاً من انتظار الاتصالات العشوائية، يمكنك بناء ملف مهني يساعد المشترين على فهم قدراتك بسرعة.",
          "en": "Joining Mujahiz IQ gives you an organized digital presence in front of companies and organizations searching for suppliers by specialization, location, products, and services. Instead of relying on random inquiries, you can build a professional profile that helps buyers understand your capabilities quickly."
        }
      },
      {
        "title": {
          "ar": "ما الذي يظهر في ملف المجهز؟",
          "en": "What Appears in a Supplier Profile?"
        },
        "body": {
          "ar": "يتضمن ملف المجهز معلومات الهوية، التخصصات، المحافظات ومناطق التغطية، وسائل التواصل، المنتجات أو الخدمات، الكلمات المفتاحية، وصف القدرات، وأي معلومات تساعد على تقييم الملاءمة قبل التواصل.",
          "en": "A supplier profile includes identity information, specializations, governorates and coverage areas, contact channels, products or services, capability keywords, and information that helps assess fit before communication."
        }
      },
      {
        "title": {
          "ar": "فوائد للمجهزين",
          "en": "Benefits for Suppliers"
        },
        "body": {
          "ar": "زيادة الظهور أمام مشترين جادين، تقليل وقت الشرح المتكرر، بناء ثقة من خلال ملف واضح، استقبال فرص أكثر ملاءمة للتخصص، وتحسين طريقة تقديم الشركة أو المكتب أو الورشة بشكل احترافي.",
          "en": "Increase visibility to serious buyers, reduce repetitive explanations, build trust through a clear profile, receive more relevant opportunities, and present your company, office, workshop, or service professionally."
        }
      },
      {
        "title": {
          "ar": "متى يكون الانضمام مناسباً؟",
          "en": "Who Should Join?"
        },
        "body": {
          "ar": "المنصة مناسبة للشركات، المكاتب، الورش، المعامل، المستوردين، الموزعين، مقدمي الخدمات، والمجهزين الأفراد ممن لديهم قدرة حقيقية على تقديم منتجات أو خدمات في السوق العراقي.",
          "en": "The platform is suitable for companies, offices, workshops, factories, importers, distributors, service providers, and individual suppliers with real capacity to provide products or services in the Iraqi market."
        }
      }
    ]
  },
  "buyers": {
    "key": "buyers",
    "slug": "/buyers",
    "title": {
      "ar": "للمشترين: وفر وقت البحث وابدأ من بيانات أوضح",
      "en": "For Buyers: Save Search Time and Start with Clearer Data"
    },
    "subtitle": {
      "ar": "اكتشف المجهزين حسب التخصص والموقع والخدمة، واجعل عملية البحث الأولي أكثر تنظيماً واحترافية.",
      "en": "Discover suppliers by specialization, location, and service, and make the initial search process more organized and professional."
    },
    "metaTitle": {
      "ar": "المشترون | بحث أسرع وقرارات شراء أوضح",
      "en": "Buyers | Faster Search and Clearer Purchasing Decisions"
    },
    "metaDescription": {
      "ar": "تساعد منصة مجهز موظفي المشتريات على الوصول إلى مجهزين موثوقين ومقارنة الخيارات بطريقة أوضح وأكثر تنظيماً.",
      "en": "Mujahiz IQ helps procurement professionals reach trusted suppliers and compare options in a clearer, more organized way."
    },
    "cta": {
      "ar": "ادخل المنصة وابدأ البحث عن مجهزين موثوقين في العراق.",
      "en": "Log in and start searching for trusted suppliers in Iraq."
    },
    "sections": [
      {
        "title": {
          "ar": "ماذا تقدم مجهز للمشتريات؟",
          "en": "What Mujahiz Offers Procurement Teams"
        },
        "body": {
          "ar": "توفر مجهز نقطة انطلاق منظمة للبحث عن المجهزين، تقليل الاعتماد على البحث العشوائي، وتسهيل الوصول إلى معلومات تساعد على تكوين قائمة أولية مناسبة قبل طلب عروض الأسعار أو بدء التواصل.",
          "en": "Mujahiz IQ provides an organized starting point for supplier discovery, reduces reliance on random searching, and helps buyers access information needed to build a suitable shortlist before requesting quotations or starting communication."
        }
      },
      {
        "title": {
          "ar": "استخدام عملي في دورة الشراء",
          "en": "Practical Use in the Purchasing Cycle"
        },
        "body": {
          "ar": "يمكن استخدام المنصة في مرحلة البحث السوقي، إعداد قائمة الموردين المحتملين، فهم خيارات السوق، توثيق التجارب، ومراجعة بيانات المجهزين قبل الانتقال إلى طلب عرض السعر أو التفاوض.",
          "en": "The platform can be used during market research, supplier shortlisting, understanding market options, documenting experiences, and reviewing supplier data before moving to quotation requests or negotiations."
        }
      },
      {
        "title": {
          "ar": "فوائد للمشترين",
          "en": "Benefits for Buyers"
        },
        "body": {
          "ar": "اختصار وقت البحث، الوصول إلى بدائل أكثر، تقليل سوء الفهم، تحسين جودة المعلومات، ومساعدة فريق المشتريات على اتخاذ قرارات مبنية على بيانات وتجارب أوضح.",
          "en": "Save search time, access more alternatives, reduce misunderstanding, improve information quality, and help procurement teams make decisions based on clearer data and experiences."
        }
      },
      {
        "title": {
          "ar": "مناسب لمن؟",
          "en": "Who Is It For?"
        },
        "body": {
          "ar": "مناسب لموظفي المشتريات، مسؤولي سلسلة التوريد، الإداريين، أصحاب الأعمال، المنظمات، الشركات، والمشاريع التي تحتاج إلى الوصول إلى مجهزين وخدمات بصورة أسرع وأكثر مهنية.",
          "en": "It is suitable for procurement officers, supply chain teams, administrators, business owners, organizations, companies, and projects that need faster and more professional access to suppliers and services."
        }
      }
    ]
  },
  "how_it_works": {
    "key": "how_it_works",
    "slug": "/how-it-works",
    "title": {
      "ar": "كيف تعمل منصة مجهز؟",
      "en": "How Does Mujahiz IQ Work?"
    },
    "subtitle": {
      "ar": "خطوات واضحة تساعد المشترين والمجهزين على الوصول إلى بعضهم بطريقة أكثر تنظيماً واحترافية.",
      "en": "Clear steps that help buyers and suppliers reach each other in a more organized and professional way."
    },
    "metaTitle": {
      "ar": "كيف تعمل منصة مجهز | خطوات بسيطة لاكتشاف المجهزين",
      "en": "How Mujahiz IQ Works | Simple Steps to Discover Suppliers"
    },
    "metaDescription": {
      "ar": "تعرف على خطوات استخدام منصة مجهز من إنشاء الحساب إلى البحث عن المجهزين وتوثيق التجارب وتحسين قرارات الشراء.",
      "en": "Learn how to use Mujahiz IQ, from account creation to supplier discovery, experience documentation, and improved purchasing decisions."
    },
    "cta": {
      "ar": "ابدأ بخطوة بسيطة: ابحث عن مجهز أو قدّم طلب الانضمام.",
      "en": "Start with one simple step: search for a supplier or submit a join request."
    },
    "sections": []
  },
  "supplier_directory": {
    "key": "supplier_directory",
    "slug": "/supplier-directory",
    "title": {
      "ar": "دليل المجهزين",
      "en": "Supplier Directory"
    },
    "subtitle": {
      "ar": "ابحث، فلتر، وابدأ من قائمة أكثر وضوحاً للمجهزين المناسبين لاحتياجك.",
      "en": "Search, filter, and start from a clearer list of suppliers suitable for your needs."
    },
    "metaTitle": {
      "ar": "دليل المجهزين | ابحث عن مجهزين حسب التصنيف والموقع",
      "en": "Supplier Directory | Search Suppliers by Category and Location"
    },
    "metaDescription": {
      "ar": "دليل منظم يساعدك على البحث عن المجهزين في العراق حسب التخصص، المحافظة، المدينة، المنتجات والخدمات.",
      "en": "An organized directory that helps you search suppliers in Iraq by specialization, governorate, city, products, and services."
    },
    "cta": {
      "ar": "استخدم الفلاتر للوصول إلى المجهز الأنسب لطلبك.",
      "en": "Use filters to reach the supplier most relevant to your request."
    },
    "sections": [
      {
        "title": {
          "ar": "ماذا يمكنك أن تبحث؟",
          "en": "What Can You Search For?"
        },
        "body": {
          "ar": "يمكن البحث عن مجهز حسب الاسم، التصنيف، التخصص، المحافظة، المدينة، المنتج، الخدمة، الكلمات المفتاحية، ومناطق التغطية.",
          "en": "You can search suppliers by name, category, specialization, governorate, city, product, service, keywords, and coverage areas."
        }
      },
      {
        "title": {
          "ar": "معلومات تظهر في النتائج",
          "en": "Information Shown in Results"
        },
        "body": {
          "ar": "تظهر بطاقة المجهز مع الاسم، نوع النشاط، المحافظة، التخصصات، وسوم القدرات، ومؤشرات تساعد على تقييم الملاءمة قبل فتح الملف الكامل.",
          "en": "The supplier card shows the name, business type, governorate, specializations, capability tags, and indicators that help assess fit before opening the full profile."
        }
      },
      {
        "title": {
          "ar": "هدف الدليل",
          "en": "Purpose of the Directory"
        },
        "body": {
          "ar": "الهدف من الدليل هو تقليل وقت البحث الأولي وتقديم نقطة بداية منظمة للمقارنة، وليس ضمان التعاقد أو تمثيل توصية نهائية بالشراء.",
          "en": "The directory aims to reduce initial search time and provide an organized starting point for comparison. It does not guarantee contracting or represent a final purchasing recommendation."
        }
      }
    ]
  },
  "join_request": {
    "key": "join_request",
    "slug": "/join",
    "title": {
      "ar": "طلب الانضمام",
      "en": "Request to Join"
    },
    "subtitle": {
      "ar": "املأ المعلومات الأساسية وسنساعدك على اختيار المسار المناسب داخل المنصة.",
      "en": "Fill in the basic information and we will help you choose the right path inside the platform."
    },
    "metaTitle": {
      "ar": "طلب الانضمام إلى مجهز",
      "en": "Request to Join Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "قدّم طلب انضمام إلى منصة مجهز كمشتري أو مجهز وابدأ بناء حضور مهني داخل شبكة المشتريات والمجهزين في العراق.",
      "en": "Submit a join request to Mujahiz IQ as a buyer or supplier and start building a professional presence in Iraq’s procurement and supplier network."
    },
    "cta": {
      "ar": "أرسل طلبك الآن وابدأ رحلتك مع مجهز.",
      "en": "Submit your request now and start your journey with Mujahiz IQ."
    },
    "sections": [
      {
        "title": {
          "ar": "قبل إرسال الطلب",
          "en": "Before Submitting"
        },
        "body": {
          "ar": "يرجى إدخال معلومات صحيحة وواضحة، واختيار نوع الاستخدام بدقة، لأن هذه البيانات تساعد على مراجعة الطلب وتصنيف الحساب بالشكل المناسب.",
          "en": "Please enter accurate and clear information and choose the correct usage type, as this helps review the request and classify the account properly."
        }
      },
      {
        "title": {
          "ar": "بعد إرسال الطلب",
          "en": "After Submission"
        },
        "body": {
          "ar": "سيتم استلام طلبك للمراجعة، وقد يتم التواصل معك لاستكمال معلومات إضافية أو توضيح بعض التفاصيل قبل تفعيل الحساب أو إدراج ملف المجهز.",
          "en": "Your request will be received for review, and you may be contacted to complete additional information or clarify details before account activation or supplier profile listing."
        }
      }
    ]
  },
  "contact": {
    "key": "contact",
    "slug": "/contact",
    "title": {
      "ar": "تواصل معنا",
      "en": "Contact Us"
    },
    "subtitle": {
      "ar": "يسعدنا استقبال استفساراتك وملاحظاتك لتحسين تجربة المشتريات والمجهزين في العراق.",
      "en": "We welcome your questions and feedback to improve the procurement and supplier experience in Iraq."
    },
    "metaTitle": {
      "ar": "تواصل معنا | مجهز",
      "en": "Contact Us | Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "تواصل مع فريق منصة مجهز للاستفسارات، الدعم، الشراكات، أو الملاحظات المتعلقة بالمجهزين والمشتريات.",
      "en": "Contact the Mujahiz IQ team for inquiries, support, partnerships, or feedback related to suppliers and procurement."
    },
    "cta": {
      "ar": "أرسل رسالتك وسنرد عليك في أقرب وقت ممكن.",
      "en": "Send your message and we will respond as soon as possible."
    },
    "sections": [
      {
        "title": {
          "ar": "للاستفسارات العامة",
          "en": "General Inquiries"
        },
        "body": {
          "ar": "استخدم نموذج التواصل لإرسال أي سؤال حول المنصة، التسجيل، آلية العمل، أو استخدام دليل المجهزين.",
          "en": "Use the contact form to send any question about the platform, registration, workflow, or using the supplier directory."
        }
      },
      {
        "title": {
          "ar": "للمجهزين",
          "en": "For Suppliers"
        },
        "body": {
          "ar": "إذا كنت ترغب بإضافة شركتك أو تحديث بيانات ملفك، يرجى ذكر اسم النشاط، المحافظة، التخصص، ورقم التواصل.",
          "en": "If you want to add your business or update your profile, please mention the business name, governorate, specialization, and contact number."
        }
      },
      {
        "title": {
          "ar": "للمشترين",
          "en": "For Buyers"
        },
        "body": {
          "ar": "إذا كنت تبحث عن مجهز ضمن تخصص معين أو تحتاج مساعدة في استخدام الفلاتر، أرسل تفاصيل مختصرة عن احتياجك.",
          "en": "If you are searching for a supplier in a specific field or need help using filters, send a brief description of your requirement."
        }
      }
    ]
  },
  "faq": {
    "key": "faq",
    "slug": "/faq",
    "title": {
      "ar": "الأسئلة الشائعة",
      "en": "Frequently Asked Questions"
    },
    "subtitle": {
      "ar": "إجابات مختصرة على أكثر الأسئلة التي قد تحتاجها قبل استخدام المنصة.",
      "en": "Short answers to the most common questions you may need before using the platform."
    },
    "metaTitle": {
      "ar": "الأسئلة الشائعة | مجهز",
      "en": "FAQs | Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "إجابات واضحة حول التسجيل، المجهزين، البحث، التحقق، الخصوصية، وآلية استخدام منصة مجهز.",
      "en": "Clear answers about registration, suppliers, search, verification, privacy, and how to use Mujahiz IQ."
    },
    "cta": {
      "ar": "لم تجد إجابتك؟ تواصل معنا وسنساعدك.",
      "en": "Did not find your answer? Contact us and we will help."
    },
    "sections": []
  },
  "resources": {
    "key": "resources",
    "slug": "/resources",
    "title": {
      "ar": "الموارد",
      "en": "Resources"
    },
    "subtitle": {
      "ar": "أدلة مختصرة ونصائح عملية لدعم المشترين والمجهزين في استخدام المنصة بفعالية.",
      "en": "Short guides and practical tips to support buyers and suppliers in using the platform effectively."
    },
    "metaTitle": {
      "ar": "الموارد | أدلة ونصائح للمشتريات والمجهزين",
      "en": "Resources | Guides and Tips for Procurement and Suppliers"
    },
    "metaDescription": {
      "ar": "موارد عملية تساعد المستخدمين على فهم أفضل للمشتريات، إعداد طلبات واضحة، التعامل مع المجهزين، وتحسين جودة القرار.",
      "en": "Practical resources that help users understand procurement, prepare clear requests, deal with suppliers, and improve decision quality."
    },
    "cta": {
      "ar": "استخدم الموارد لتحسين طريقة البحث والتواصل داخل المنصة.",
      "en": "Use the resources to improve searching and communication inside the platform."
    },
    "sections": [
      {
        "title": {
          "ar": "دليل الاستخدام",
          "en": "User Guide"
        },
        "body": {
          "ar": "شرح مبسط لكيفية التسجيل، البحث، استخدام الفلاتر، فتح ملفات المجهزين، وإدارة الحساب داخل المنصة.",
          "en": "A simple guide explaining how to register, search, use filters, open supplier profiles, and manage the account inside the platform."
        }
      },
      {
        "title": {
          "ar": "نصائح للمشترين",
          "en": "Tips for Buyers"
        },
        "body": {
          "ar": "اكتب احتياجك بوضوح، حدد الكمية والمواصفات، قارن أكثر من خيار، ولا تعتمد على السعر فقط عند تقييم العروض.",
          "en": "Write your requirement clearly, define quantity and specifications, compare multiple options, and do not rely on price alone when evaluating offers."
        }
      },
      {
        "title": {
          "ar": "نصائح للمجهزين",
          "en": "Tips for Suppliers"
        },
        "body": {
          "ar": "حدّث بياناتك باستمرار، اكتب وصفاً واضحاً لقدراتك، أضف تخصصات دقيقة، واجعل وسائل التواصل صحيحة وسهلة الوصول.",
          "en": "Keep your information updated, write a clear description of your capabilities, add accurate specializations, and make contact channels correct and easy to access."
        }
      }
    ]
  },
  "terms": {
    "key": "terms",
    "slug": "/terms",
    "title": {
      "ar": "شروط الاستخدام",
      "en": "Terms of Use"
    },
    "subtitle": {
      "ar": "توضح هذه الشروط القواعد العامة لاستخدام المنصة ومسؤوليات المستخدمين.",
      "en": "These terms explain the general rules for using the platform and user responsibilities."
    },
    "metaTitle": {
      "ar": "شروط الاستخدام | مجهز",
      "en": "Terms of Use | Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "شروط عامة لاستخدام منصة مجهز، تشمل مسؤوليات المستخدمين وحدود استخدام البيانات والمحتوى.",
      "en": "General terms for using Mujahiz IQ, including user responsibilities and limits on data and content use."
    },
    "cta": {
      "ar": "يرجى مراجعة الشروط قبل استخدام المنصة أو تقديم بياناتك.",
      "en": "Please review the terms before using the platform or submitting your data."
    },
    "sections": [
      {
        "title": {
          "ar": "قبول الشروط",
          "en": "Acceptance of Terms"
        },
        "body": {
          "ar": "باستخدامك لمنصة مجهز، فإنك توافق على الالتزام بشروط الاستخدام والسياسات المرتبطة بها. إذا كنت لا توافق على هذه الشروط، يرجى عدم استخدام المنصة.",
          "en": "By using Mujahiz IQ, you agree to comply with these Terms of Use and related policies. If you do not agree, please do not use the platform."
        }
      },
      {
        "title": {
          "ar": "مسؤولية المستخدم",
          "en": "User Responsibility"
        },
        "body": {
          "ar": "يتحمل المستخدم مسؤولية صحة المعلومات التي يقدمها، وعدم استخدام المنصة لأي غرض مخالف للقانون أو يسيء إلى المستخدمين الآخرين أو يضر بسمعة السوق.",
          "en": "The user is responsible for the accuracy of the information provided and must not use the platform for any unlawful purpose or any activity that harms other users or market trust."
        }
      },
      {
        "title": {
          "ar": "طبيعة المنصة",
          "en": "Nature of the Platform"
        },
        "body": {
          "ar": "مجهز توفر مساحة للبحث والتنظيم والتواصل المهني. لا تمثل المنصة ضماناً لجودة كل مجهز أو التزاماً بالتعاقد، ويجب على المستخدمين إجراء التحقق والعناية الواجبة قبل أي قرار شراء.",
          "en": "Mujahiz IQ provides a workspace for discovery, organization, and professional communication. The platform does not guarantee every supplier’s quality or guarantee contracting. Users must perform their own verification and due diligence before purchasing decisions."
        }
      },
      {
        "title": {
          "ar": "تحديث الشروط",
          "en": "Updates to Terms"
        },
        "body": {
          "ar": "قد يتم تحديث هذه الشروط من وقت لآخر بما يتناسب مع تطوير المنصة، وسيتم نشر النسخة الأحدث داخل هذه الصفحة.",
          "en": "These terms may be updated from time to time as the platform evolves. The latest version will be published on this page."
        }
      }
    ]
  },
  "privacy": {
    "key": "privacy",
    "slug": "/privacy",
    "title": {
      "ar": "سياسة الخصوصية",
      "en": "Privacy Policy"
    },
    "subtitle": {
      "ar": "نحترم خصوصية المستخدمين ونعمل على التعامل مع البيانات بمسؤولية ووضوح.",
      "en": "We respect user privacy and aim to handle data responsibly and transparently."
    },
    "metaTitle": {
      "ar": "سياسة الخصوصية | مجهز",
      "en": "Privacy Policy | Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "توضح سياسة الخصوصية كيفية جمع واستخدام وحماية البيانات داخل منصة مجهز.",
      "en": "This privacy policy explains how data is collected, used, and protected inside Mujahiz IQ."
    },
    "cta": {
      "ar": "لأي سؤال حول الخصوصية، يرجى التواصل مع فريق المنصة.",
      "en": "For any privacy-related question, please contact the platform team."
    },
    "sections": [
      {
        "title": {
          "ar": "البيانات التي نجمعها",
          "en": "Data We Collect"
        },
        "body": {
          "ar": "قد نجمع بيانات مثل الاسم، البريد الإلكتروني، رقم الهاتف، اسم الشركة أو المؤسسة، الموقع، التخصصات، وبيانات الاستخدام اللازمة لتشغيل وتحسين المنصة.",
          "en": "We may collect data such as name, email address, phone number, company or organization name, location, specializations, and usage data necessary to operate and improve the platform."
        }
      },
      {
        "title": {
          "ar": "كيف نستخدم البيانات",
          "en": "How We Use Data"
        },
        "body": {
          "ar": "نستخدم البيانات لإنشاء الحسابات، إدارة ملفات المجهزين، تحسين البحث، التواصل مع المستخدمين، مراجعة الطلبات، وتطوير خدمات المنصة.",
          "en": "We use data to create accounts, manage supplier profiles, improve search, communicate with users, review requests, and develop platform services."
        }
      },
      {
        "title": {
          "ar": "مشاركة البيانات",
          "en": "Data Sharing"
        },
        "body": {
          "ar": "لا نبيع بيانات المستخدمين. قد تظهر بعض بيانات المجهزين للزوار أو المستخدمين بحسب إعدادات الملف والغرض من الدليل، بينما تبقى البيانات الحساسة محمية ولا يتم مشاركتها إلا وفق الحاجة أو المتطلبات القانونية.",
          "en": "We do not sell user data. Some supplier profile information may appear to visitors or users depending on profile settings and directory purpose, while sensitive data remains protected and is not shared except as needed or required by law."
        }
      },
      {
        "title": {
          "ar": "حقوق المستخدم",
          "en": "User Rights"
        },
        "body": {
          "ar": "يمكن للمستخدم طلب تحديث بياناته أو تصحيحها أو حذفها وفق آلية المنصة والسياسات المعتمدة.",
          "en": "Users may request to update, correct, or delete their information according to the platform workflow and applicable policies."
        }
      }
    ]
  },
  "security": {
    "key": "security",
    "slug": "/security",
    "title": {
      "ar": "سياسة الأمان",
      "en": "Security Policy"
    },
    "subtitle": {
      "ar": "الأمان مسؤولية مشتركة بين المنصة والمستخدمين لضمان بيئة عمل موثوقة.",
      "en": "Security is a shared responsibility between the platform and users to maintain a trusted workspace."
    },
    "metaTitle": {
      "ar": "سياسة الأمان | مجهز",
      "en": "Security Policy | Mujahiz IQ"
    },
    "metaDescription": {
      "ar": "إرشادات الأمان في منصة مجهز لحماية الحسابات والبيانات وتقليل الاستخدام غير المصرح به.",
      "en": "Security guidance for Mujahiz IQ to protect accounts, data, and reduce unauthorized use."
    },
    "cta": {
      "ar": "ساعدنا في الحفاظ على منصة آمنة وموثوقة للجميع.",
      "en": "Help us maintain a secure and trusted platform for everyone."
    },
    "sections": [
      {
        "title": {
          "ar": "حماية الحساب",
          "en": "Account Protection"
        },
        "body": {
          "ar": "يجب استخدام كلمة مرور قوية وعدم مشاركتها مع الآخرين. يتحمل المستخدم مسؤولية أي استخدام يتم من خلال حسابه إذا نتج عن مشاركة بيانات الدخول أو إهمالها.",
          "en": "Users should use a strong password and must not share it with others. The user is responsible for account activity resulting from shared or neglected login credentials."
        }
      },
      {
        "title": {
          "ar": "الوصول إلى البيانات",
          "en": "Data Access"
        },
        "body": {
          "ar": "يتم تنظيم صلاحيات الوصول بحسب نوع المستخدم والدور داخل المنصة، مع الحفاظ على البيانات الحساسة وفق ضوابط الأمان المناسبة.",
          "en": "Data access is managed based on user type and role inside the platform, while sensitive data is protected through appropriate security controls."
        }
      },
      {
        "title": {
          "ar": "الإبلاغ عن مشكلة أمنية",
          "en": "Reporting a Security Issue"
        },
        "body": {
          "ar": "إذا لاحظت نشاطاً مشبوهاً أو مشكلة أمنية، يرجى التواصل فوراً مع فريق المنصة وتزويدنا بالتفاصيل اللازمة للتحقق والمعالجة.",
          "en": "If you notice suspicious activity or a security issue, please contact the platform team immediately and provide the necessary details for investigation and resolution."
        }
      }
    ]
  }
} as const satisfies Record<string, PublicContentPage>;

export type PublicPageKey = keyof typeof publicPages;

export const publicFaqItems = [
  {
    "question": {
      "ar": "ما هي منصة مجهز؟",
      "en": "What is Mujahiz IQ?"
    },
    "answer": {
      "ar": "مجهز هي منصة رقمية مهنية تربط العاملين في المشتريات وسلسلة التوريد بالمجهزين والمعلومات السوقية بصورة منظمة وقابلة للبحث.",
      "en": "Mujahiz IQ is a professional digital platform that connects procurement and supply chain professionals with suppliers and market information in an organized, searchable way."
    }
  },
  {
    "question": {
      "ar": "هل مجهز متجر إلكتروني؟",
      "en": "Is Mujahiz IQ an online store?"
    },
    "answer": {
      "ar": "لا. مجهز ليست متجراً إلكترونياً لبيع المنتجات مباشرة، بل منصة لاكتشاف المجهزين وتنظيم المعلومات وتسهيل التواصل المهني.",
      "en": "No. Mujahiz IQ is not an online store for direct product sales. It is a platform for supplier discovery, information organization, and professional communication."
    }
  },
  {
    "question": {
      "ar": "من يمكنه استخدام المنصة؟",
      "en": "Who can use the platform?"
    },
    "answer": {
      "ar": "يمكن أن يستخدمها موظفو المشتريات، مسؤولو سلسلة التوريد، الشركات، المنظمات، أصحاب الأعمال، والمجهزون الذين يقدمون منتجات أو خدمات في السوق العراقي.",
      "en": "Procurement officers, supply chain teams, companies, organizations, business owners, and suppliers providing products or services in the Iraqi market can use the platform."
    }
  },
  {
    "question": {
      "ar": "كيف أبحث عن مجهز؟",
      "en": "How do I search for a supplier?"
    },
    "answer": {
      "ar": "يمكنك البحث بالاسم أو التصنيف أو المحافظة أو المدينة أو المنتج أو الخدمة أو الكلمات المفتاحية، ثم استخدام الفلاتر للوصول إلى نتائج أكثر دقة.",
      "en": "You can search by name, category, governorate, city, product, service, or keyword, then use filters to reach more accurate results."
    }
  },
  {
    "question": {
      "ar": "هل جميع المجهزين معتمدون؟",
      "en": "Are all suppliers verified?"
    },
    "answer": {
      "ar": "تعمل المنصة على تنظيم وتصفية البيانات وفق معايير واضحة. ومع ذلك، يجب على المشتري إجراء العناية الواجبة والتحقق النهائي قبل أي تعامل تجاري.",
      "en": "The platform organizes and filters data according to clear criteria. However, buyers should conduct due diligence and final verification before any commercial transaction."
    }
  },
  {
    "question": {
      "ar": "كيف يمكنني الانضمام كمجهز؟",
      "en": "How can I join as a supplier?"
    },
    "answer": {
      "ar": "اضغط على طلب الانضمام، أدخل معلوماتك الأساسية وتفاصيل النشاط، ثم أرسل الطلب للمراجعة أو الاستكمال حسب آلية المنصة.",
      "en": "Click Request to Join, enter your basic information and business details, then submit the request for review or completion according to the platform workflow."
    }
  },
  {
    "question": {
      "ar": "هل يمكن تحديث بيانات المجهز؟",
      "en": "Can supplier information be updated?"
    },
    "answer": {
      "ar": "نعم، يمكن للمجهز تحديث بياناته عند الحاجة من خلال الحساب أو عبر التواصل مع فريق المنصة بحسب الصلاحيات المتاحة.",
      "en": "Yes. Suppliers can update their information when needed through their account or by contacting the platform team, depending on available permissions."
    }
  },
  {
    "question": {
      "ar": "هل المنصة تضمن الأسعار أو التعاقد؟",
      "en": "Does the platform guarantee prices or contracts?"
    },
    "answer": {
      "ar": "لا تضمن المنصة الأسعار أو التعاقدات. دورها هو تسهيل الوصول إلى المعلومات والمجهزين، بينما تبقى قرارات الشراء والتعاقد مسؤولية الأطراف المعنية.",
      "en": "No. The platform does not guarantee prices or contracts. Its role is to facilitate access to information and suppliers, while purchasing and contracting decisions remain the responsibility of the parties involved."
    }
  },
  {
    "question": {
      "ar": "هل بياناتي آمنة؟",
      "en": "Is my data secure?"
    },
    "answer": {
      "ar": "تتعامل المنصة مع البيانات بمسؤولية، وتعمل على حماية البيانات الحساسة وفق سياسات الخصوصية والأمان المعتمدة.",
      "en": "The platform handles data responsibly and aims to protect sensitive information according to its privacy and security policies."
    }
  },
  {
    "question": {
      "ar": "كيف أتواصل مع فريق المنصة؟",
      "en": "How can I contact the platform team?"
    },
    "answer": {
      "ar": "يمكنك استخدام صفحة تواصل معنا أو البريد الإلكتروني المعتمد داخل الفوتر لإرسال استفسارك أو ملاحظتك.",
      "en": "You can use the Contact Us page or the email listed in the footer to send your inquiry or feedback."
    }
  },
  {
    "question": {
      "ar": "هل يمكن للمشتري تقييم تجربة مجهز؟",
      "en": "Can buyers review supplier experiences?"
    },
    "answer": {
      "ar": "بحسب صلاحيات المنصة، يمكن إضافة ملاحظات أو مراجعات تساعد على بناء قاعدة معرفية تشاركية أكثر فائدة للمستخدمين.",
      "en": "Depending on platform permissions, users may add notes or reviews that help build a more useful shared knowledge base."
    }
  },
  {
    "question": {
      "ar": "ما الفرق بين المجهز والمشتري؟",
      "en": "What is the difference between a supplier and a buyer?"
    },
    "answer": {
      "ar": "المجهز هو جهة تقدم منتجات أو خدمات. المشتري هو مستخدم يبحث عن مجهزين أو معلومات سوقية لدعم احتياجات الشراء أو التوريد.",
      "en": "A supplier provides products or services. A buyer is a user searching for suppliers or market information to support purchasing or supply needs."
    }
  }
] as const;
