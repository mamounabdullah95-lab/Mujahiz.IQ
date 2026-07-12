import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      appName: "Mujahiz IQ",
      arabicName: "Ù…Ø¬Ù‡Ø² IQ",
      tagline: "Mujahiz.. the starting point for real savings.",
      language: "Language",
      ar: "AR",
      en: "EN",
      loading: "Loading",
      save: "Save",
      edit: "Edit",
      deleteSupplier: "Delete",
      cancel: "Cancel",
      back: "Back",
      next: "Next",
      actions: "Actions",
      submit: "Submit",
      approve: "Approve",
      reject: "Reject",
      requestCorrection: "Request correction",
      markDuplicate: "Mark duplicate",
      merge: "Merge",
      search: "Search",
      navHome: "Home",
      navAbout: "About Mujahiz",
      navSuppliers: "Suppliers",
      navBuyers: "Buyers",
      navHowItWorks: "How It Works",
      navFaqs: "FAQs",
      navContact: "Contact Us",
      homepageSlogan: "Mujahiz.. the starting point for real savings.",
      homepageHeroText: "A professional platform for procurement and supply chain teams. We help you reach trusted suppliers, evaluate market experiences, and build a searchable shared knowledge base.",
      trustVerifiedSuppliers: "Trusted and verified suppliers",
      trustSecureData: "Secure and confidential data",
      trustRealSavings: "Real savings and clearer visibility",
      footerDescription: "A professional procurement and supply chain platform built to create a trusted, transparent, and smarter business network.",
      quickLinks: "Quick Links",
      resources: "Resources",
      userGuide: "User Guide",
      termsOfUse: "Terms of Use",
      privacyPolicy: "Privacy Policy",
      securityPolicy: "Security Policy",
      contactUs: "Contact Us",
      iraq: "Iraq",
      copyright: "Â© 2026 Mujahiz IQ. All rights reserved.",
      loginDescription: "A professional platform for procurement and supply chain professionals, helping you reach trusted suppliers and submit your requests easily and securely.",
      registerDescription: "Create your account to access the Mujahiz smart platform, discover savings opportunities, and connect with trusted suppliers across Iraq.",
      rememberMe: "Remember me",
      forgotPassword: "Forgot password?",
      noAccount: "Don't have an account?",
      alreadyHaveAccount: "Already have an account?",
      publicSearchPlaceholder: "Search for a supplier, product, service, or sector...",
      appSearchPlaceholder: "Search for a supplier, product, or request...",
      directoryDescription: "Find approved suppliers by category, location, capability, and market experience.",
      askSupplierDirectory: "Ask the supplier directory",
      askSupplierDirectoryDescription: "Describe the material, location, payment method, and credit terms. The system will recommend the five strongest matches from approved supplier data.",
      procurementRequest: "Procurement requirement",
      procurementRequestPlaceholder: "Example: I need a valve supplier in Basra or Baghdad that accepts bank transfer and 30-day payment after invoicing.",
      recommendSuppliers: "Recommend suppliers",
      topSupplierRecommendations: "Top 5 supplier recommendations",
      recommendationCount: "{{count}} recommendations",
      matchScore: "Match",
      noMatchingRecommendations: "No approved supplier currently matches the requested material and conditions.",
      geminiSearchFallback: "Gemini was unavailable, so the local recommendation engine completed the search.",
      recommendationReason_category: "Category match",
      recommendationReason_text: "Material or service match",
      recommendationReason_location: "Location match",
      recommendationReason_payment: "Payment method match",
      recommendationReason_credit: "Credit terms match",
      recommendationReason_quality: "Rating and confidence",
      recommendationReason_freshness: "Recently updated",
      recommendationMatched: "Matched",
      recommendationUnconfirmed: "Not confirmed",
      recommendationNotMatched: "Not matched",
      filters: "Filters",
      clear: "Clear",
      details: "Details",
      profile: "Profile",
      dashboard: "Dashboard",
      directory: "Directory",
      addSupplier: "Add supplier",
      editApprovedSupplier: "Edit approved supplier",
      editApprovedSupplierDescription: "Update the approved supplier record. Ratings, reviews, and contribution history will remain unchanged.",
      approvedSupplierUpdated: "The approved supplier was updated successfully.",
      supplierDeleted: "The approved supplier was deleted successfully.",
      supplierDeleteFailed: "Could not delete the approved supplier.",
      confirmDeleteSupplier: "Delete {{name}} from approved suppliers? This action cannot be undone.",
      supplierNotFound: "Supplier record was not found.",
      saveChanges: "Save changes",
      resetChanges: "Reset changes",
      confirmResetSupplierChanges: "Discard the unsaved changes and restore the approved supplier record?",
      supplierChangesReset: "Unsaved supplier changes were discarded.",
      readyToSave: "The supplier record is complete and ready to save.",
      mySubmissions: "My Messages",
      myAccess: "My access",
      myReviews: "My reviews",
      admin: "Admin",
      adminDashboard: "Admin dashboard",
      users: "Users",
      pendingUsers: "Pending users",
      reviewQueue: "Supplier review queue",
      reviewModeration: "Review moderation",
      approvedSuppliers: "Approved suppliers",
      categories: "Categories",
      settings: "Settings",
      auditLogs: "Audit logs",
      supplierFeedbackAdmin: "Supplier feedback",
      materialDictionary: "Material dictionary",
      materialDictionaryDescription: "Review the platform's material vocabulary and approve new terms discovered from supplier searches.",
      activeMaterialTerms: "Active material terms",
      pendingTermSuggestions: "Pending term suggestions",
      pendingTermSuggestionsDescription: "These terms were captured from searches but are not yet part of the official dictionary.",
      noPendingTermSuggestions: "No pending term suggestions",
      canonicalEn: "Canonical English name",
      canonicalAr: "Canonical Arabic name",
      synonyms: "Synonyms",
      brands: "Brands",
      standards: "Standards",
      examples: "Examples",
      seenCount: "Seen {{count}} time(s)",
      ignore: "Ignore",
      termSuggestionApproved: "The term was added to the material dictionary.",
      termSuggestionIgnored: "The term suggestion was ignored.",
      materialDictionaryCategoryRequired: "Choose a main category before approving this term.",
      login: "Login",
      register: "Register",
      logout: "Logout",
      email: "Email Address",
      password: "Password",
      fullName: "Full Name",
      phone: "Phone Number",
      jobTitle: "Job Title",
      organization: "Company / Organization",
      governorate: "Governorate",
      city: "City",
      sector: "Procurement Field / Sector",
      reasonForJoining: "Reason for joining",
      createAccount: "Create Account",
      fullNamePlaceholder: "Enter your full name",
      passwordPlaceholder: "Enter your password",
      loginPasswordPlaceholder: "Enter your password",
      phonePlaceholder: "7XXXXXXXX",
      organizationPlaceholder: "Enter company or organization name",
      jobTitlePlaceholder: "Enter your job title",
      governoratePlaceholder: "Select governorate",
      cityPlaceholder: "Select city",
      sectorPlaceholder: "Select procurement field or sector",
      reasonForJoiningPlaceholder: "Write your reason for joining...",
      dismiss: "Dismiss",
      registrationSuccessMessage: "You have joined successfully. You have 3 free days to use the platform. To get a longer access period, upload 10 supplier records inside the platform to receive one free month. The more approved suppliers you add, the longer your free access becomes.",
      completeProfile: "Complete profile",
      pendingApprovalTitle: "Your profile is pending approval",
      pendingApprovalBody: "You can submit suppliers now. Full directory access starts after admin approval and approved contribution credits.",
      noAccessTitle: "Access is not active yet",
      noAccessBody: "Every 10 approved new supplier records grants 30 days of directory access.",
      supplierName: "Supplier name",
      displayName: "Display name",
      companyNameLanguage: "Company name language",
      businessType: "Business type",
      arabicCompanyName: "Arabic company name",
      englishCompanyName: "English company name",
      shortDescription: "Short description",
      location: "Location",
      marketArea: "Main market / area",
      address: "Full address",
      googleMapsLink: "Google Maps link",
      coverageAreas: "Coverage areas",
      supplierBranches: "Supplier branches",
      supplierBranchesDescription: "Add branch locations when the supplier has different offices or contacts in multiple cities.",
      addBranch: "Add branch",
      removeBranch: "Remove branch",
      contactInfo: "Contact information",
      primaryPhone: "Primary phone",
      secondaryPhone: "Secondary phone",
      whatsapp: "WhatsApp",
      website: "Website",
      facebook: "Facebook",
      instagramLinkedin: "Instagram / LinkedIn",
      contactPerson: "Contact person",
      contactPersonRole: "Contact role",
      capabilities: "Capabilities",
      mainCategory: "Main category",
      subcategories: "Subcategories",
      subcategoriesPlaceholder: "Example: pumps, valves, cable trays",
      capabilityTags: "Capability tags",
      operationalCapabilities: "Supply capabilities",
      supplierDocumentation: "Documentation and business readiness",
      sectorExperience: "Sector experience",
      paymentOptions: "Payment options",
      acceptsCredit: "Accepts credit payment",
      creditDays: "Credit days",
      creditDaysPlaceholder: "Example: 30, 60, 90",
      creditStart: "Credit period starts",
      creditTermsNote: "Credit terms note",
      sourceConfidence: "Source and confidence",
      sourceType: "How do you know this supplier?",
      confidenceLevel: "Confidence level",
      directExperience: "Previous direct experience",
      lastInteractionYear: "Year of last interaction",
      relatedMaterialService: "Related material/service",
      sourceNote: "Short note",
      duplicateWarning: "Possible duplicate warning",
      submitForReview: "Submit for review",
      submissionThanks: "Thank you. Your supplier submission has been sent for review. It will count toward your access only after approval.",
      completionScore: "Completion score",
      source: "Source",
      confidence: "Confidence",
      status: "Status",
      role: "Role",
      access: "Access",
      accessExpires: "Access Expiry",
      points: "Points",
      badges: "Badges",
      pendingSubmissions: "Requests Pending Review",
      needsCorrection: "Needs correction",
      rejected: "Rejected",
      approved: "Approved",
      remainingForNextMonth: "Remaining for next month",
      availableCredits: "Available contribution credits",
      accessDaysRemaining: "Remaining Access Days",
      accessCovered: "Access covered",
      monthlyChallenge: "Monthly challenge",
      rating: "Rating",
      reviews: "Reviews",
      ratingOutOfFive: "{{rating}} / 5",
      lastUpdated: "Last updated",
      submitReview: "Submit review",
      writeReview: "Write a review",
      hideReviewForm: "Hide review form",
      professionalCommentPlaceholder: "Write a professional comment based on your experience. Avoid insults or unsupported accusations.",
      interactionType: "Interaction type",
      relatedCategory: "Related category",
      positiveTags: "Positive tags",
      concernTags: "Concern tags",
      comment: "Comment",
      overall: "Overall",
      responseSpeed: "Response speed",
      priceClarity: "Price clarity",
      flexibility: "Flexibility",
      technicalCompliance: "Technical compliance",
      technicalKnowledge: "Technical knowledge",
      deliveryCommitment: "Delivery commitment",
      contractCommitment: "Contract commitment",
      quality: "Quality",
      communication: "Communication",
      documentation: "Documentation",
      duplicateReason: "Matching reason",
      high: "High",
      medium: "Medium",
      low: "Low",
      unknown: "Unknown",
      yes: "Yes",
      no: "No",
      notSure: "Not sure",
      not_sure: "Not sure",
      noResults: "No results",
      all: "All",
      allIraq: "All Iraq",
      advancedSearch: "Advanced search",
      notifications: "Notifications",
      noNotifications: "No notifications",
      notificationRejectedSubmissions_one: "{{count}} rejected supplier submission",
      notificationRejectedSubmissions_other: "{{count}} rejected supplier submissions",
      notificationApprovedSubmissions_one: "{{count}} approved supplier submission",
      notificationApprovedSubmissions_other: "{{count}} approved supplier submissions",
      notificationPendingSuppliers_one: "{{count}} supplier waiting for review",
      notificationPendingSuppliers_other: "{{count}} suppliers waiting for review",
      notificationPendingReviews_one: "{{count}} review waiting for moderation",
      notificationPendingReviews_other: "{{count}} reviews waiting for moderation",
      notificationPendingFeedback_one: "{{count}} supplier feedback item waiting for review",
      notificationPendingFeedback_other: "{{count}} supplier feedback items waiting for review",
      notificationFeedbackResolved_one: "{{count}} supplier feedback item was resolved",
      notificationFeedbackResolved_other: "{{count}} supplier feedback items were resolved",
      editCorrection: "Correct submission",
      correctionResubmitted: "The corrected supplier submission has been sent back for review.",
      supplierSubmissionNotFound: "Supplier submission was not found.",
      supplierSubmissionCannotEdit: "This submission cannot be edited now.",
      row: "Row",
      landingHeadline: "Mujahiz IQ",
      landingLead: "A professional platform for procurement and supply chain teams, helping you discover trusted suppliers, evaluate market experiences, and build a searchable knowledge base.",
      landingAction: "Login",
      requestAccess: "Join Request",
      landingDirectoryTitle: "Supplier Directory",
      landingReviewTitle: "Filtering & Verification",
      landingAccessTitle: "Trusted Workspace",
      landingBadgesTitle: "Quotation Analysis",
      landingDirectoryBody: "Search verified suppliers by category, city, products, and services.",
      landingReviewBody: "Supplier data is organized through clear criteria to help you reach more reliable options.",
      landingAccessBody: "A secure workspace for sharing information and communicating with verified suppliers.",
      landingBadgesBody: "Compare quotations easily based on price, quali×_uÖÚ$z{-®éÜj×Æ–VE÷Gvó¢-Š­˜RŠ­Šİ˜]˜­˜B‹]˜˜­˜b˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆ´–×÷'DÆ–VEöfWs¢-Š­˜RŠ­Šİ˜]˜­˜B·¶6÷VçG×Ò‹]˜˜˜˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆ´–×÷'DÆ–VEöÖç“¢-Š­˜RŠ­Šİ˜]˜­˜B·¶6÷VçG×Ò‹]˜˜½Šr˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆ´–×÷'DÆ–VEö÷F†W#¢-Š­˜RŠ­Šİ˜]˜­˜B·¶6÷VçG×Ò‹]˜˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆµ&Wf–WuF—FÆS¢-˜]‹Š}ŠÍ‹Š’Š}˜M˜]ŠÍ˜}‹-˜­˜bŠı˜‹Š’˜Š}ŠİŠıŠ’"À¢7WÆ–W$'VÆµ&Wf–Wt&öG“¢'·¶6÷VçG×Ò‹]˜ŠÍŠ}˜}‹"˜M˜M˜]‹Š}ŠÍ‹Š’â˜­˜ŠÍŠò·¶–çfÆ–G×Ò‹]˜˜­ŠİŠ­Š}ŠÂŠ]˜M˜’Š]˜=˜]Š}˜BŠ}˜MŠİ˜-˜˜BŠ}˜M˜]‹}˜M˜ŠŠ’â"À¢7WÆ–W$'VÆµ7V&Ö—E÷¦W&ó¢-Š]‹‹=Š}˜BŠ}˜MŠı˜‹Š’"À¢7WÆ–W$'VÆµ7V&Ö—EööæS¢-Š]‹‹=Š}˜B˜]ŠÍ˜}‹"˜Š}ŠİŠò"À¢7WÆ–W$'VÆµ7V&Ö—E÷Gvó¢-Š]‹‹=Š}˜B˜]ŠÍ˜}‹-˜­˜b"À¢7WÆ–W$'VÆµ7V&Ö—EöfWs¢-Š]‹‹=Š}˜B·¶6÷VçG×Ò˜]ŠÍ˜}‹-˜­˜b"À¢7WÆ–W$'VÆµ7V&Ö—EöÖç“¢-Š]‹‹=Š}˜B·¶6÷VçG×Ò˜]ŠÍ˜}‹-˜½Šr"À¢7WÆ–W$'VÆµ7V&Ö—Eö÷F†W#¢-Š]‹‹=Š}˜B·¶6÷VçG×Ò˜]ŠÍ˜}‹""À¢7WÆ–W$'VÆµ7V&Ö—GFVE÷¦W&ó¢-˜M˜R˜­Š­˜RŠ]‹‹=Š}˜BŠ=˜¢‹}˜MŠ‚â"À¢7WÆ–W$'VÆµ7V&Ö—GFVEööæS¢-Š­˜RŠ]‹‹=Š}˜B‹}˜MŠ‚˜]ŠÍ˜}‹"˜Š}ŠİŠò˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆµ7V&Ö—GFVE÷Gvó¢-Š­˜RŠ]‹‹=Š}˜B‹}˜MŠ˜­˜b˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆµ7V&Ö—GFVEöfWs¢-Š­˜RŠ]‹‹=Š}˜B·¶6÷VçG×Ò‹}˜MŠŠ}Š¢˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆµ7V&Ö—GFVEöÖç“¢-Š­˜RŠ]‹‹=Š}˜B·¶6÷VçG×Ò‹}˜MŠ˜½Šr˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆµ7V&Ö—GFVEö÷F†W#¢-Š­˜RŠ]‹‹=Š}˜B·¶6÷VçG×Ò‹}˜MŠ‚˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆ´VF—EF—FÆS¢-Š­‹Šı˜­˜B˜]ŠÍ˜}‹"˜]‹=Š­˜‹Šò"À¢7WÆ–W$'VÆ´VF—D&öG“¢-Š=˜=˜]˜BŠ˜­Š}˜mŠ}Š¢Š}˜M‹]˜··&÷w×Ò˜}˜mŠ}ˆÂŠ½˜RŠ}Šİ˜‹˜rŠıŠ}Ší˜B˜-Š}Šm˜]Š’Š}˜M˜]‹Š}ŠÍ‹Š’Š}˜MŠÍ˜]Š}‹˜­Š’Š=˜‚Š=‹‹=˜B˜}‹ŠrŠ}˜M˜]ŠÍ˜}‹"˜]˜m˜‹ŠıŠ}˜²â"À¢6fTæE&WGW&ã¢-Šİ˜‹‚˜Š}˜M‹˜ŠıŠ’"À¢&6µFô'VÆµ&Wf–Ws¢-Š}˜M‹˜ŠıŠ’Š]˜M˜’˜]‹Š}ŠÍ‹Š’Š}˜MŠı˜‹Š’"À¢6VæEF†—57WÆ–W#¢-Š]‹‹=Š}˜B˜}‹ŠrŠ}˜M˜]ŠÍ˜}‹""À¢7WÆ–W$'VÆ´—FVÕ6fVC¢-Š­˜RŠİ˜‹‚‹]˜Š}˜M˜]ŠÍ˜}‹"ŠıŠ}Ší˜B˜-Š}Šm˜]Š’Š}˜M˜]‹Š}ŠÍ‹Š’Š}˜MŠÍ˜]Š}‹˜­Š’â"À¢7WÆ–W$'VÆ´—FVÕ7V&Ö—GFVC¢-Š­˜RŠ]‹‹=Š}˜B˜}‹ŠrŠ}˜M˜]ŠÍ˜}‹"˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢7WÆ–W$'VÆ´æô7F—fT—FVÓ¢-˜MŠr˜­˜ŠÍŠò˜]ŠÍ˜}‹"˜]‹=Š­˜‹Šò˜]˜Š­˜ŠÒŠİŠ}˜M˜­Š}˜²â"À¢FE7WÆ–W$G&gE&W7F÷&VC¢-Š­˜]Š¢Š}‹=Š­‹Š}ŠıŠ’Š}˜M˜]‹=˜ŠıŠ’Š}˜M˜]Šİ˜˜‹Š’Š­˜M˜-Š}Šm˜­Š}˜²â"À¢FE7WÆ–W$G&gE&W6WC¢-Š­˜]Š¢Š]‹Š}ŠıŠ’‹mŠ‹r‹]˜ŠİŠ’Š]‹mŠ}˜Š’˜]ŠÍ˜}‹"â"À¢6öæf—&Õ&W6WDFE7WÆ–W%vS¢-˜}˜BŠ­‹˜­Šò˜]‹=ŠÒ˜]‹=˜ŠıŠ’Š]‹mŠ}˜Š’Š}˜M˜]ŠÍ˜}‹"Š}˜MŠİŠ}˜M˜­Š’˜Š}˜M‹]˜˜˜Š}˜M˜]‹=Š­˜‹ŠıŠ‰ò"À¢&W6WDFE7WÆ–W%vS¢-Š]‹Š}ŠıŠ’‹mŠ‹rŠ}˜M‹]˜ŠİŠ’"À¢7WÆ–W$–×÷'EFöôÆ&vS¢-ŠİŠÍ˜RŠ}˜M˜]˜M˜Š=˜=Š‹˜]˜b˜=˜­˜M˜ŠŠ}˜­Š¢â"À¢7WÆ–W$–×÷'Dæôf–VÆG3¢-˜M˜R˜­Š­˜RŠ}˜M‹Š½˜‹‹˜M˜’Šİ˜-˜˜B˜]ŠÍ˜}‹"˜]‹}Š}Š˜-Š’˜˜¢˜}‹ŠrŠ}˜M˜]˜M˜â"À¢7WÆ–W$–×÷'Df–ÆVC¢-Š­‹‹‹Š¢˜-‹Š}ŠŠ’˜}‹ŠrŠ}˜M˜]˜M˜â"À¢Vç7W÷'FVE7WÆ–W$–×÷'Df–ÆS¢-˜­‹ŠÍ˜’‹˜‹’˜]˜M˜ç†Ç7‚Š=˜‚æ77bâ"À¢Vç7W÷'FVE7WÆ–W$–×÷'D'&÷w6W#¢-˜}‹ŠrŠ}˜M˜]Š­‹]˜ŠÒ˜MŠr˜­‹=Š­‹}˜­‹’˜-‹Š}ŠŠ’˜]˜M˜Š}Š¢W†6VÂŠ}˜M˜]‹m‹­˜‹}Š’âŠÍ‹™Š‚Š­‹]Šı˜­‹Š}˜M˜m˜]˜‹ŠÂŠ‹]˜­‹­Š’55bâ"À¢–çfÆ–E7WÆ–W$–×÷'Df–ÆS¢-Š}˜M˜]˜M˜Š}˜M˜]‹˜˜‹’˜MŠr˜­ŠŠı˜‚˜=˜m˜]˜‹ŠÂW†6VÂ‹]Š}˜MŠÒâ"À¢FÖ–äöæÇ“¢-˜M˜MŠ]ŠıŠ}‹Š’˜˜-‹r"À¢7F—fS¢-˜‹Š}˜B"À¢VæF–æs¢-˜-˜­ŠòŠ}˜MŠ}˜mŠ­‹Š}‹"À¢7W7VæFVC¢-˜]˜˜-˜˜"À¢FV×÷&'“¢-˜]ŠM˜-Š¢"À¢W‡—&VC¢-˜]˜mŠ­˜}˜¢"À¢7&VFVDC¢-Š­Š}‹˜­ŠâŠ}˜MŠ]˜m‹MŠ}Š"À¢WFFVDC¢-Š-Ší‹Š­ŠİŠı˜­Š²"À¢FÖ–äæ÷FW3¢-˜]˜MŠ}Šİ‹Š}Š¢Š}˜MŠ]ŠıŠ}‹Š’"À¢6öçG&–'WF÷#¢-Š}˜M˜]‹=Š}˜}˜R"À¢&Wf–WvW#¢-Š}˜M˜]‹Š}ŠÍ‹’"À¢VÆ—G•&F–ó¢-˜m‹=ŠŠ’Š}˜MŠÍ˜ŠıŠ’"À¢7VvvW7FVDFV6—6–öã¢-Š}˜M˜-‹Š}‹Š}˜M˜]˜-Š­‹ŠÒ"À¢&÷fUv—F„VF—G3¢-Š}‹Š­˜]Š}Šò˜]‹’Š­‹Šı˜­˜B"À¢FDæ÷F†W%7WÆ–W#¢-Š]‹mŠ}˜Š’˜]ŠÍ˜}‹"Š-Ší‹"À¢6VVDFVfVÇG3¢-Š]‹mŠ}˜Š’Š}˜MŠ˜­Š}˜mŠ}Š¢Š}˜MŠ}˜Š­‹Š}‹m˜­Š’"À¢WFFU6WGF–æw3¢-Š­ŠİŠı˜­Š²Š}˜MŠ]‹ŠıŠ}ŠıŠ}Š¢"À¢&WV—&VE7WÆ–W'5W$ÖöçFƒ¢-‹ŠıŠòŠ}˜M˜]ŠÍ˜}‹-˜­˜bŠ}˜M˜]‹}˜M˜Š‚‹M˜}‹˜­˜½Šr"À¢F—4w&çFVEW$&F6ƒ¢-Š}˜MŠ=˜­Š}˜RŠ}˜M˜]˜]˜m˜ŠİŠ’˜M˜=˜BŠı˜‹Š’"À¢Ö†–×VÕ7F6¶&ÆTÖöçF‡3¢-Š=˜-‹]˜’‹ŠıŠòŠ=‹M˜}‹˜-Š}Š˜MŠ’˜M˜MŠ­ŠÍ˜]˜­‹’"À¢w&6UW&–öDF—3¢-Š=˜­Š}˜RŠ}˜M‹=˜]Š}ŠÒ"À¢G&–Ä66W74F—3¢-Š=˜­Š}˜RŠ}˜MŠ­ŠÍ‹ŠŠ’Š}˜MŠ=˜˜M˜’"À¢&Wf–Ww4V&ä&öçW5ö–çG3¢-Š}˜M˜]‹Š}ŠÍ‹Š}Š¢Š­˜]˜mŠÒ˜m˜-Š}‹}˜½ŠrŠ]‹mŠ}˜˜­Š’"À¢WFFT6öçG&–'WF–öç46äV&ä66W74&öçW3¢-Š­ŠİŠı˜­Š²Š}˜MŠ˜­Š}˜mŠ}Š¢˜­˜]˜mŠÒ‹‹]˜­Šò˜‹]˜˜B"À¢6fVC¢-Š­˜RŠ}˜MŠİ˜‹‚â"À¢FVfVÇG56VVFVC¢-Š­˜]Š¢Š]‹mŠ}˜Š’Š}˜M˜-˜­˜RŠ}˜MŠ}˜Š­‹Š}‹m˜­Š’â"À¢÷væW$öæÇ•6WGF–æw3¢-Š­‹Šı˜­˜BŠ]‹ŠıŠ}ŠıŠ}Š¢Š}˜M˜]˜m‹]Š’˜]Š­Š}ŠÒ˜MŠİ‹=Š}Š‚Š}˜M˜]Š}˜M˜2˜˜-‹râ"À¢v÷fW&æ÷&FW3¢-Š}˜M˜]ŠİŠ}˜‹Š}Š¢"À¢7WÆ–W$6FVv÷'”Æ—7C¢-Š­‹]˜m˜­˜Š}Š¢Š}˜M˜]ŠÍ˜}‹-˜­˜b"À¢FD—FVÓ¢-Š]‹mŠ}˜Š’‹˜m‹]‹"À¢—FVÔ¶W“¢-Š}˜M˜]˜Š­Š}ŠÒ"À¢VævÆ—6„Æ&VÃ¢-Š}˜MŠ­‹=˜]˜­Š’ŠŠ}˜MŠ]˜m˜=˜M˜­‹-˜­Š’"À¢&&–4Æ&VÃ¢-Š}˜MŠ­‹=˜]˜­Š’ŠŠ}˜M‹‹Š˜­Š’"À¢6—G”÷$Ö&¶WD&V¢-Š}˜M˜]Šı˜­˜mŠ’Š=˜‚˜]˜m‹}˜-Š’Š}˜M‹=˜˜""À¢6öçF7DÖWF†öC¢-˜‹=˜­˜MŠ’Š}Š­‹]Š}˜B"À¢6&–Æ—G•Fs¢-˜‹=˜R˜-Šı‹Š’"À¢Ö—76–æu&WV—&VDf–VÆG3¢-Š}˜MŠİ˜-˜˜BŠ}˜M˜mŠ}˜-‹]Š“¢·¶f–VÆG7×Ò"À¢&VG”f÷$FÖ–å&Wf–Ws¢-ŠÍŠ}˜}‹"˜MŠ]‹‹=Š}˜M˜rŠ]˜M˜’˜]‹Š}ŠÍ‹Š’Š}˜MŠ]ŠıŠ}‹Š’â"À¢7WÆ–W%7V&Ö—Df–ÆVC¢-Š­‹‹‹Š]‹‹=Š}˜BŠ}˜M˜]ŠÍ˜}‹"â"À¢æôGWÆ–6FUv&æ–æs¢-˜MŠr˜­˜ŠÍŠòŠ­˜mŠ˜­˜rŠ­˜=‹Š}‹˜]˜b˜˜}‹‹2Š}˜M˜]ŠÍ˜}‹-˜­˜bŠ}˜M˜]‹Š­˜]Šı˜­˜bŠ}˜MŠİŠ}˜M˜¢â"À¢æô66W75&öw&W73¢-˜MŠı˜­˜2·¶f–Æ&ÆW×Ò˜]‹=Š}˜}˜]Š}Š¢˜]ŠÍ˜}‹-˜­˜b˜]‹Š­˜]ŠıŠ’˜‹­˜­‹˜]‹=Š­ŠíŠı˜]Š’â˜­Š­Š˜-˜’··&VÖ–æ–æw×Ò˜M˜Š­ŠÒ·¶F—7×Ò˜­˜˜]˜½ŠrŠ]‹mŠ}˜˜­˜½Šrâ"À¢7F'E7V&Ö—GF–æu7WÆ–W'3¢-Š}ŠŠıŠ2ŠŠ]‹‹=Š}˜B˜]ŠÍ˜}‹-˜­˜b˜M˜]‹Š}ŠÍ‹Š’Š}˜MŠ]ŠıŠ}‹Š’â"À¢æÖTÆæwVvT&&–3¢-‹‹Š˜¢"À¢æÖTÆæwVvTVævÆ—6ƒ¢-Š]˜m˜=˜M˜­‹-˜¢"À¢æÖTÆæwVvTÖ—†VC¢-˜]ŠíŠ­˜M‹r"À¢æÖTÆæwVvUö&&–3¢-‹‹Š˜¢"À¢æÖTÆæwVvUöVævÆ—6ƒ¢-Š]˜m˜=˜M˜­‹-˜¢"À¢æÖTÆæwVvUöÖ—†VC¢-˜]ŠíŠ­˜M‹r"À¢7V&Ö—GFVDC¢-Š­Š}‹˜­ŠâŠ}˜MŠ]‹‹=Š}˜B"À¢æôFW67&—F–öã¢-˜MŠr˜­˜ŠÍŠò˜‹]˜˜]‹mŠ}˜â"À¢7WÆ–W$–FVçF—G“¢-˜}˜˜­Š’Š}˜M˜]ŠÍ˜}‹""À¢æW‡E7FW¢-Š}˜MŠí‹}˜Š’Š}˜MŠ­Š}˜M˜­Š’"À¢6öÖÖVçEFöôÆöæs¢-˜­ŠÍŠ‚Š=˜MŠr˜­Š­ŠÍŠ}˜‹"Š}˜MŠ­‹˜M˜­˜"SŠİ‹˜â"À¢&öfW76–öæÅ&Wf–Wu&WV—&VC¢-˜­‹ŠÍ˜’˜=Š­Š}ŠŠ’˜]‹Š}ŠÍ‹Š’˜]˜}˜m˜­Š’˜˜]Š˜m˜­Š’‹˜M˜’Š­ŠÍ‹ŠŠ’˜Š}‹mŠİŠ’â"À¢&Wf–Wu6VçDf÷$ÖöFW&F–öã¢-Š­˜RŠ]‹‹=Š}˜BŠ}˜M˜]‹Š}ŠÍ‹Š’˜M˜M˜]˜Š}˜˜-Š’â"À¢7WÆ–W$fVVF&6³¢-Š}˜MŠ]Š˜MŠ}‹¢‹˜b˜]˜MŠ}Šİ‹Š’"À¢7WÆ–W$fVVF&6´FW67&—F–öã¢-Š=‹‹=˜BŠ­‹]Šİ˜­Šİ˜½ŠrŠ=˜‚˜]˜MŠ}Šİ‹Š’Šİ˜˜B˜]‹˜M˜˜]Š}Š¢˜}‹ŠrŠ}˜M˜]ŠÍ˜}‹"Š}˜M˜]˜m‹M˜‹Š’â‹=Š­‹Š}ŠÍ‹’Š}˜MŠ]ŠıŠ}‹Š’Š}˜M˜]˜MŠ}Šİ‹Š’˜-Š˜BŠ­‹Šı˜­˜BŠ}˜M‹=ŠÍ˜Bâ"À¢fVVF&6µG—S¢-˜m˜‹’Š}˜M˜]˜MŠ}Šİ‹Š’"À¢fVVF&6´ÖW76vS¢-˜]ŠrŠ}˜M˜]‹˜M˜˜]Š’‹­˜­‹Š}˜M‹]Šİ˜­ŠİŠ’Š=˜‚Š}˜MŠ­˜¢Š­ŠİŠ­Š}ŠÂŠ]˜M˜’˜]‹Š}ŠÍ‹Š‰ò"À¢fVVF&6´ÖW76vUÆ6V†öÆFW#¢-Š}‹M‹ŠÒŠ}˜M˜]˜MŠ}Šİ‹Š’Š˜‹m˜ŠÒ˜ŠİŠıŠòŠ}˜MŠİ˜-˜BŠ}˜M‹˜¢˜­ŠİŠ­Š}ŠÂŠ]˜M˜’˜]‹Š}ŠÍ‹Š’â"À¢7VvvW7FVD6÷'&V7F–öã¢-Š}˜MŠ­‹]Šİ˜­ŠÒŠ}˜M˜]˜-Š­‹ŠÒ"À¢7VvvW7FVD6÷'&V7F–öåÆ6V†öÆFW#¢-Š=‹m˜Š}˜M˜]‹˜M˜˜]Š’Š}˜M‹]Šİ˜­ŠİŠ’Š]‹Šr˜=Š}˜mŠ¢˜]Š­˜˜‹Š’˜MŠı˜­˜2â"À¢7V&Ö—DfVVF&6³¢-Š]‹‹=Š}˜BŠ}˜M˜]˜MŠ}Šİ‹Š’"À¢fVVF&6µ7V&Ö—GFVC¢-Š­˜RŠ]‹‹=Š}˜B˜]˜MŠ}Šİ‹Š­˜2Š]˜M˜’Š}˜MŠ]ŠıŠ}‹Š’˜M˜M˜]‹Š}ŠÍ‹Š’â"À¢fVVF&6µ7V&Ö—Df–ÆVC¢-Š­‹‹‹Š]‹‹=Š}˜BŠ}˜M˜]˜MŠ}Šİ‹Š’â"À¢fVVF&6´†—7F÷'“¢-˜]˜MŠ}Šİ‹Š}Š­˜2Šİ˜˜B˜}‹ŠrŠ}˜M˜]ŠÍ˜}‹""À¢fVVF&6µG—Uö–æ6÷'&V7Eö–æf÷&ÖF–öã¢-˜]‹˜M˜˜]Š}Š¢‹­˜­‹‹]Šİ˜­ŠİŠ’"À¢fVVF&6µG—Uö6öçF7Eö—77VS¢-Ší˜M˜B˜˜¢Š}˜M˜}Š}Š­˜Š=˜‚Š}˜MŠ‹˜­ŠòŠ=˜‚Š}˜M˜]˜˜-‹’"À¢fVVF&6µG—UöÆö6F–öåö—77VS¢-Ší˜M˜B˜˜¢Š}˜M˜]˜˜-‹’Š=˜‚Š}˜M˜‹˜‹’"À¢fVVF&6µG—Uö6FVv÷'•ö—77VS¢-Š­‹]˜m˜­˜‹­˜­‹‹]Šİ˜­ŠÒ"À¢fVVF&6µG—UöGWÆ–6FU÷7WÆ–W#¢-˜]ŠÍ˜}‹"˜]˜=‹‹"À¢fVVF&6µG—Uö'W6–æW75ö6Æ÷6VC¢-Š}˜M‹M‹˜=Š’˜]‹­˜M˜-Š’Š=˜‚‹­˜­‹˜‹Š}˜MŠ’"À¢fVVF&6µG—Uö÷F†W#¢-˜]˜MŠ}Šİ‹Š’Š=Ší‹˜’"À¢fVVF&6µ7FGW5÷VæF–æs¢-ŠŠ}˜mŠ­‹Š}‹Š}˜M˜]‹Š}ŠÍ‹Š’"À¢fVVF&6µ7FGW5ö–å÷&Wf–Ws¢-˜-˜­ŠòŠ}˜M˜]‹Š}ŠÍ‹Š’"À¢fVVF&6µ7FGW5÷&W6öÇfVC¢-Š­˜]Š¢Š}˜M˜]‹Š}˜MŠÍŠ’"À¢fVVF&6µ7FGW5÷&V¦V7FVC¢-Š=‹­˜M˜-Š¢Šı˜˜bŠ­‹Šı˜­˜B"À¢fVVF&6´FÖ–äFW67&—F–öã¢-‹Š}ŠÍ‹’Š}˜MŠ­‹]Šİ˜­ŠİŠ}Š¢˜Š}˜M˜]˜MŠ}Šİ‹Š}Š¢Š}˜MŠ­˜¢˜­‹‹=˜M˜}ŠrŠ}˜M˜]‹=Š­ŠíŠı˜]˜˜bŠİ˜˜B‹=ŠÍ˜MŠ}Š¢Š}˜M˜]ŠÍ˜}‹-˜­˜bŠ}˜M˜]‹Š­˜]Šı˜­˜bâ"À¢fVVF&6´FÖ–äæ÷FW3¢-‹ŠòŠ}˜MŠ]ŠıŠ}‹Š’"À¢fVVF&6´FV6—6–öåö–å÷&Wf–Ws¢-ŠŠıŠŠ}˜M˜]‹Š}ŠÍ‹Š’"À¢fVVF&6´FV6—6–öå÷&W6öÇfVC¢-Š­˜]Š¢Š}˜M˜]‹Š}˜MŠÍŠ’"À¢fVVF&6´FV6—6–öå÷&V¦V7FVC¢-Š]‹­˜MŠ}˜"Šı˜˜bŠ­‹Šı˜­˜B"À¢fVVF&6´FV6—6–öå6fVC¢-Š­˜RŠ­ŠİŠı˜­Š²ŠİŠ}˜MŠ’Š}˜M˜]˜MŠ}Šİ‹Š’â"À¢fVVF&6´÷Vå7WÆ–W#¢-˜Š­ŠÒŠ}˜M˜]ŠÍ˜}‹""À¢æõ7WÆ–W$fVVF&6³¢-˜MŠrŠ­˜ŠÍŠò˜]˜MŠ}Šİ‹Š}Š¢˜]ŠÍ˜}‹-˜­˜bŠŠ}˜mŠ­‹Š}‹Š}˜M˜]‹Š}ŠÍ‹Š’â"À¢&V¦V7FVD'•&Wf–WvW#¢-Š­˜RŠ}˜M‹˜‹b˜]˜bŠ}˜M˜]‹Š}ŠÍ‹’â"À¢F—46÷VçE÷¦W&ó¢'·¶6÷VçG×Ò˜­˜˜R"À¢F—46÷VçEööæS¢-˜­˜˜R˜Š}ŠİŠò"À¢F—46÷VçE÷Gvó¢-˜­˜˜]Š}˜b"À¢F—46÷VçEöfWs¢'·¶6÷VçG×ÒŠ=˜­Š}˜R"À¢F—46÷VçEöÖç“¢'·¶6÷VçG×Ò˜­˜˜]˜½Šr"À¢F—46÷VçEö÷F†W#¢'·¶6÷VçG×Ò˜­˜˜R"À¢F6†&ö&EvVÆ6öÖS¢-˜]‹ŠİŠŠ}˜²Š˜2˜˜¢˜]ŠÍ˜}‹-ˆÂ˜­˜]˜=˜m˜2Š]ŠıŠ}‹Š’˜‹]˜˜M˜2˜˜]Š­Š}Š‹Š’Š=ŠıŠ}Šm˜2Š‹=˜}˜˜MŠ’â"À¢F6†&ö&D7F—f—G”æ÷FS¢-˜­˜]˜=˜m˜2Š]ŠıŠ}‹Š’˜‹]˜˜M˜=ˆÂ˜]Š­Š}Š‹Š’˜m˜-Š}‹}˜=ˆÂ˜]‹Š}ŠÍ‹Š’Š}˜M‹}˜MŠŠ}Š­ˆÂ˜Š˜mŠ}ŠŠİ‹m˜‹˜2ŠıŠ}Ší˜B˜]ŠÍŠ­˜]‹’Š}˜M˜]‹MŠ­‹˜­Š}Š¢˜‹=˜M‹=˜MŠ’Š}˜MŠ­˜‹˜­Šòâ"À¢&V6VçD7F—f—G“¢-Š}˜M˜m‹MŠ}‹rŠ}˜MŠ=Ší˜­‹"À¢7F—f—G”66W75WFFVC¢-Š­˜RŠ­ŠİŠı˜­Š²ŠİŠ}˜MŠ’Š}˜M˜‹]˜˜B˜Š}ŠİŠ­‹=Š}Š‚Š}˜M˜m˜-Š}‹rŠ}˜MŠİŠ}˜M˜­Š’â"À¢7F—f—G•VæF–æu&WVW7G3¢'·¶6÷VçG×Ò‹}˜MŠ‚ŠŠ}˜mŠ­‹Š}‹Š}˜M˜]‹Š}ŠÍ‹Š’â"À¢VæF–æu&WVW7EVæ—C¢-‹}˜MŠ‚ŠŠ}˜mŠ­‹Š}‹Š}˜M˜]‹Š}ŠÍ‹Š’"À¢&VÖ–æ–ætF—5Væ—C¢-˜­˜˜]Š}˜²˜]Š­Š˜-˜­Š’"À¢&÷fVE&Wf–WuVæ—C¢-˜]‹Š}ŠÍ‹Š’˜]‹Š­˜]ŠıŠ’"ÂF6†&ö&D66W75&öw&W73¢-˜MŠı˜­˜2·¶f–Æ&ÆW×Ò˜]ŠÍ˜}‹-˜­˜b˜]‹Š­˜]Šı˜­˜bâŠ=‹m˜··&VÖ–æ–æw×Ò˜]ŠÍ˜}‹-˜­˜b˜]‹Š­˜]Šı˜­˜b˜M˜Š­ŠÒ·¶F—7×Ò˜­˜˜]˜½Šr˜]˜bŠ}˜M˜‹]˜˜Bâ"À¢F6†&ö&D66W74V&æVC¢-Šİ‹]˜MŠ¢‹˜M˜’·¶ÖöçF‡7×ÒŠı˜‹Š’˜‹]˜˜Bâ˜­Š­Š˜-˜’··&VÖ–æ–æw×Ò˜]ŠÍ˜}‹-˜­˜b˜]‹Š­˜]Šı˜­˜b˜M˜M˜‹]˜˜BŠ]˜M˜’Š}˜MŠı˜‹Š’Š}˜MŠ­Š}˜M˜­Š’â"À¢F6†&ö&D66W746÷fW&VC¢-˜‹]˜˜M˜2˜]‹­‹}˜’ŠİŠ­˜’·¶FFW×Òâ˜MŠı˜­˜2·¶F—7×Ò˜­˜˜]˜½Šr˜]Š­Š˜-˜­˜½Š}ˆÂ˜‹=˜­‹˜}‹Š­ŠİŠı˜¢Š}˜M˜]‹=Š}˜}˜]Š}Š¢Š}˜M˜-Š}Šı˜R‹˜mŠòŠ}˜-Š­‹Š}Š‚Š}˜MŠ­ŠÍŠı˜­Šòâ"À¢×”66W746÷fW&VDFW67&—F–öã¢-˜‹]˜˜M˜2Š}˜MŠİŠ}˜M˜¢˜]‹­‹}˜’˜M˜]ŠıŠ’·¶F—7×Ò˜­˜˜]˜½ŠrŠ]‹mŠ}˜˜­˜½Šrâ‹=˜­‹˜}‹Š­˜-Šı˜RŠ}˜M˜]‹=Š}˜}˜]Š}Š¢‹˜mŠòŠ}˜-Š­‹Š}Š‚˜]˜‹ŠòŠ}˜MŠ­ŠÍŠı˜­Šòâ"À¢ÖöçF†Ç”6†ÆÆVævTFW67&—F–öã¢-Š­ŠİŠı˜¢Š}˜MŠı˜‹Š“¢Š=‹m˜··&WV—&VG×Ò˜]ŠÍ˜}‹-˜­˜b˜]˜Š½˜-˜­˜bâ"À¢66W756÷W&6U÷7WÆ–W%ö6öçG&–'WF–öã¢-˜]‹=Š}˜}˜]Š’˜]ŠÍ˜}‹""À¢66W756÷W&6UöÖçVÅöw&6S¢-˜]˜mŠİŠ’˜­Šı˜˜­Š’"À¢66W756÷W&6U÷G&–Åö66W73¢-˜‹]˜˜BŠ­ŠÍ‹˜­Š˜¢"À¢GWÆ–6FU÷6ÖU÷†öæS¢-˜m˜‹2‹˜-˜RŠ}˜M˜}Š}Š­˜"À¢GWÆ–6FU÷6ÖUöVÖ–Ã¢-˜m˜‹2Š}˜MŠ‹˜­ŠòŠ}˜MŠ]˜M˜=Š­‹˜˜m˜¢"À¢GWÆ–6FU÷6ÖU÷vV'6—FS¢-˜m˜‹2Š}˜M˜]˜˜-‹’Š}˜MŠ]˜M˜=Š­‹˜˜m˜¢"À¢GWÆ–6FU÷6ÖUöf6V&öö³¢-˜m˜‹2‹]˜ŠİŠ’˜˜­‹=Š˜˜2"À¢GWÆ–6FU÷6–Ö–Æ%öæÖS¢-Š}‹=˜R˜]‹MŠ}Š˜r"À¢GWÆ–6FUö6öçF7E÷†öæS¢-Š­‹}Š}Š˜"˜}Š}Š­˜ŠÍ˜}Š’Š}˜MŠ}Š­‹]Š}˜B"À¢7FGW5ö÷væW#¢-˜]Š}˜M˜2"À¢7FGW5öFÖ–ã¢-˜]Šı˜­‹"À¢7FGW5ö6öçG&–'WF÷#¢-˜]‹=Š}˜}˜R"À¢7FGW5÷f–WvW#¢-˜]‹MŠ}˜}Šò"À¢7FGW5÷7W7VæFVC¢-˜]˜˜-˜˜"À¢7FGW5ö&÷fVC¢-˜]‹Š­˜]Šò"À¢7FGW5ö7F—fS¢-˜‹Š}˜B"À¢7FGW5÷VæF–æs¢-˜-˜­ŠòŠ}˜MŠ}˜mŠ­‹Š}‹"À¢7FGW5÷VæF–æuö&÷fÃ¢-ŠŠ}˜mŠ­‹Š}‹Š}˜MŠ}‹Š­˜]Š}Šò"À¢7FGW5÷VæF–æu÷&Wf–Ws¢-ŠŠ}˜mŠ­‹Š}‹Š}˜M˜]‹Š}ŠÍ‹Š’"À¢7FGW5÷÷76–&ÆUöGWÆ–6FS¢-Š­˜=‹Š}‹˜]ŠİŠ­˜]˜B"À¢7FGW5öæVVG5ö6÷'&V7F–öã¢-˜­ŠİŠ­Š}ŠÂŠ­‹]Šİ˜­ŠÒ"À¢7FGW5÷&V¦V7FVC¢-˜]‹˜˜‹b"À¢7FGW5÷FV×÷&'“¢-˜]ŠM˜-Š¢"À¢7FGW5öW‡—&VC¢-˜]˜mŠ­˜}˜¢"À¢7FGW5ö&6†—fVC¢-˜]ŠM‹‹M˜"À¢7FGW5öÖW&vVC¢-˜]Šı˜]ŠÂ"À¢7FGW5ö6öÖ×Væ—G•÷7V&Ö—GFVC¢-˜]‹mŠ}˜˜]˜bŠ}˜M˜]ŠÍŠ­˜]‹’"À¢7FGW5÷fW&–f–VC¢-˜]˜Š½˜""À¢7FGW5öæVVG5öÖ÷&Uö–æfó¢-˜­ŠİŠ­Š}ŠÂ˜]‹˜M˜˜]Š}Š¢Š]‹mŠ}˜˜­Š’"À¢7FGW5÷vF6†Æ—7C¢-˜-Š}Šm˜]Š’˜]Š­Š}Š‹Š’"À¢VF—EöFVÖõ÷W6W%÷&Vv—7FW&VC¢-Š­˜RŠ­‹=ŠÍ˜­˜B˜]‹=Š­ŠíŠı˜RŠ­ŠÍ‹˜­Š˜¢"À¢VF—E÷W6W%÷&Vv—7FW&VC¢-Š­˜RŠ­‹=ŠÍ˜­˜B˜]‹=Š­ŠíŠı˜R"À¢VF—E÷W6W%÷G&–Åö66W75÷7F'FVC¢-ŠŠıŠ2Š}˜M˜‹]˜˜BŠ}˜MŠ­ŠÍ‹˜­Š˜¢"À¢VF—E÷W6W%ö&÷fVC¢-Š­˜RŠ}‹Š­˜]Š}Šò˜]‹=Š­ŠíŠı˜R"À¢VF—E÷W6W%÷&öÆU÷7FGW5÷WFFVC¢-Š­˜RŠ­ŠİŠı˜­Š²Šı˜‹ıŠİŠ}˜MŠ’Š}˜M˜]‹=Š­ŠíŠı˜R"À¢VF—Eö66W75÷FV×÷&'•öw&çFVC¢-Š­˜R˜]˜mŠÒ˜‹]˜˜B˜]ŠM˜-Š¢"À¢VF—E÷6WGF–æw5÷WFFVC¢-Š­˜RŠ­ŠİŠı˜­Š²Š}˜MŠ]‹ŠıŠ}ŠıŠ}Š¢"À¢VF—E÷6VVEöFVfVÇG3¢-Š­˜]Š¢Š]‹mŠ}˜Š’Š}˜M˜-˜Š}Šm˜RŠ}˜MŠ}˜Š­‹Š}‹m˜­Š’"À¢VF—E÷7WÆ–W%÷7V&Ö—76–öåö&÷fVC¢-Š­˜RŠ}‹Š­˜]Š}ŠòŠ]‹‹=Š}˜B˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%÷7V&Ö—76–öå÷&V¦V7FVC¢-Š­˜R‹˜‹bŠ]‹‹=Š}˜B˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%÷7V&Ö—76–öåöæVVG5ö6÷'&V7F–öã¢-Š]‹‹=Š}˜B˜]ŠÍ˜}‹"˜­ŠİŠ­Š}ŠÂŠ­‹]Šİ˜­ŠÒ"À¢VF—E÷7WÆ–W%÷7V&Ö—76–öå÷÷76–&ÆUöGWÆ–6FS¢-Š­˜RŠ­‹˜M˜­˜RŠ]‹‹=Š}˜B˜]ŠÍ˜}‹"˜=Š­˜=‹Š}‹˜]ŠİŠ­˜]˜B"À¢VF—E÷7WÆ–W%÷7V&Ö—76–öåöÖW&vVC¢-Š­˜RŠı˜]ŠÂŠ]‹‹=Š}˜B˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%÷7V&Ö—76–öå÷&W7V&Ö—GFVC¢-Š­˜RŠ]‹Š}ŠıŠ’Š]‹‹=Š}˜B‹}˜MŠ‚˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%÷WFFVC¢-Š­˜RŠ­ŠİŠı˜­Š²˜]ŠÍ˜}‹"˜]‹Š­˜]Šò"À¢VF—E÷7WÆ–W%öFVÆWFVC¢-Š­˜RŠİ‹˜˜]ŠÍ˜}‹"˜]‹Š­˜]Šò"À¢VF—E÷&Wf–Wuö&÷fVC¢-Š­˜RŠ}‹Š­˜]Š}Šò˜]‹Š}ŠÍ‹Š’"À¢VF—E÷&Wf–Wu÷&V¦V7FVC¢-Š­˜R‹˜‹b˜]‹Š}ŠÍ‹Š’"À¢VF—E÷7WÆ–W%öfVVF&6µö–å÷&Wf–Ws¢-ŠŠıŠ=Š¢˜]‹Š}ŠÍ‹Š’˜]˜MŠ}Šİ‹Š’˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%öfVVF&6µ÷&W6öÇfVC¢-Š­˜]Š¢˜]‹Š}˜MŠÍŠ’˜]˜MŠ}Šİ‹Š’˜]ŠÍ˜}‹""À¢VF—E÷7WÆ–W%öfVVF&6µ÷&V¦V7FVC¢-Š=‹­˜M˜-Š¢˜]˜MŠ}Šİ‹Š’˜]ŠÍ˜}‹"Šı˜˜bŠ­‹Šı˜­˜B"À¢VF—E÷FW&Õ÷7VvvW7F–öåö&÷fVC¢-Š­˜RŠ}‹Š­˜]Š}Šò˜]˜‹ŠıŠ’˜]˜-Š­‹ŠİŠ’"À¢VF—E÷FW&Õ÷7VvvW7F–öåö–væ÷&VC¢-Š­˜RŠ­ŠÍŠ}˜}˜B˜]˜‹ŠıŠ’˜]˜-Š­‹ŠİŠ’"À¢F&vWE÷W6W#¢-˜]‹=Š­ŠíŠı˜R"À¢F&vWE÷7WÆ–W%7V&Ö—76–öã¢-Š]‹‹=Š}˜B˜]ŠÍ˜}‹""À¢F&vWE÷7WÆ–W#¢-˜]ŠÍ˜}‹""À¢F&vWE÷6WGF–æw3¢-Š]‹ŠıŠ}ŠıŠ}Š¢"À¢F&vWE÷&Wf–Ws¢-˜]‹Š}ŠÍ‹Š’"À¢F&vWE÷7WÆ–W$fVVF&6³¢-˜]˜MŠ}Šİ‹Š’˜]ŠÍ˜}‹""À¢F&vWE÷FW&Õ7VvvW7F–öã¢-˜]˜‹ŠıŠ’˜]˜-Š­‹ŠİŠ’"À¢ÆöDÖ÷&S¢-‹‹‹bŠ}˜M˜]‹-˜­Šò"À¢ÖVçS¢-Š}˜M˜-Š}Šm˜]Š’"À¢6Æ÷6TÖVçS¢-Š]‹­˜MŠ}˜"Š}˜M˜-Š}Šm˜]Š’"À¢ÒÀ¢ÒÀ§Ó° ¦“†âçW6R†–æ—E&V7D“†æW‡B’æ–æ—B‡°¢&W6÷W&6W2À¢Ææs¢Æö6Å7F÷&vRævWD—FVÒ‚&×V¦†—¢Ö—ÖÆö6ÆR"’ÇÂ&Vâ"À¢fÆÆ&6´Ææs¢&Vâ"À¢–çFW'öÆF–öã¢°¢W66UfÇVS¢fÇ6RÀ¢ÒÀ§Ò“° ¦W‡÷'BFVfVÇB“†ã°    