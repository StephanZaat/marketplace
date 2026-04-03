import React, { createContext, useContext, useState } from "react";

export type Lang = "en" | "es";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<Lang, any> = {
  en: {
    // Header
    sell: "Sell",
    messages: "Messages",
    profile: "Profile",
    logIn: "Log in",
    signUp: "Sign up",
    logOut: "Log out",
    searchPlaceholder: "Search listings...",
    sellSomething: "Sell something",

    // Home – hero
    heroBadge: "Aruba's local marketplace",
    heroTitle: "Marketplace",
    heroSubtitle: "Buy and sell anything locally on the island.\nNo fees, no fuss — just great deals.",
    postListing: "Post a listing",
    browseListings: "Browse listings",

    // Home – stats
    activeListings: "Active listings",
    registeredSellers: "Registered sellers",
    zeroFees: "Zero fees, always",

    // Home – categories
    shopByCategory: "Shop by Category",
    viewAll: "View all",
    showAllCategories: "Show all {n} categories",
    showLess: "Show less",

    // Home – sections
    recentlyAdded: "Recently Added",
    mostPopular: "Most Popular",
    howItWorks: "How It Works",
    noListingsYet: "No listings yet",
    beFirstToSell: "Be the first to sell something on Marketplace.aw",

    // How it works steps
    step1Title: "Create a free account",
    step1Desc: "Sign up in seconds. No credit card, no subscription — it's completely free.",
    step2Title: "List your item",
    step2Desc: "Add photos, set your price and reach buyers all across Aruba in minutes.",
    step3Title: "Chat & close the deal",
    step3Desc: "Message buyers directly, agree on a price, and meet up locally.",

    // Footer
    arubaMarketplace: "Aruba's local marketplace",
    contactUs: "Contact Us",

    // Login
    welcomeBack: "Welcome back",
    email: "Email",
    password: "Password",
    signingIn: "Signing in...",
    signIn: "Sign in",
    forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?",

    // Register
    createAccount: "Create your account",
    fullName: "Full name",
    creating: "Creating account...",
    alreadyHaveAccount: "Already have an account?",
    passwordHint: "Min 8 chars, upper, lower, number",

    // ForgotPassword
    forgotPasswordTitle: "Forgot your password?",
    forgotPasswordSub: "Enter your email address and we'll send you a link to reset your password.",
    sendResetLink: "Send reset link",
    sending: "Sending...",
    backToSignIn: "Back to sign in",
    resetEmailSent: "If that email address is registered, we've sent a password reset link. Check your inbox.",

    // Profile
    listings: "Listings",
    sold: "Sold",
    favorites: "Favorites",
    noListings: "No listings yet.",
    listFirstItem: "List your first item",
    noSoldItems: "No sold items yet.",
    noExpiredListings: "No expired listings.",
    expiredTabHint: "These listings have expired and are no longer visible to buyers. Renew them to make them active again.",
    noFavorites: "No favorites yet.",
    heartToSave: "Heart a listing to save it here.",
    editProfile: "Edit profile",
    relist: "Relist",
    joined: "Joined",

    // ListingCard
    free: "Free",
    reserved: "Reserved",

    // Condition labels
    condNew: "New",
    condLikeNew: "Like New",
    condGood: "Good",
    condFair: "Fair",
    condPoor: "Poor",

    // Contact
    contactTitle: "Contact Us",
    contactSub: "We usually respond within 1 business day.",
    name: "Name",
    subject: "Subject",
    message: "Message",
    sendMessage: "Send message",
    messageSent: "Message sent!",
    messageSentSub: "Thanks for reaching out. We'll get back to you as soon as possible.",
    backToHome: "Back to home",

    // Settings / Profile — languages
    languagesSpoken: "Languages spoken",
    langEnglish: "English",
    langSpanish: "Spanish",
    langPapiamento: "Papiamento",
    langDutch: "Dutch",

    // Listings page
    allListings: "All Listings",
    categories: "Categories",
    sortLabel: "Sort:",
    filterLabel: "Filter:",
    sortDate: "Date",
    sortPrice: "Price",
    sortPopular: "Popular",
    filterLocation: "Location",
    filterCondition: "Condition",
    filterPrice: "Price",
    freeItemsOnly: "Free items only",
    anyLocation: "Any location",
    anyCondition: "Any condition",
    priceRange: "Price range (AWG)",
    clearFilters: "Clear filters",
    items: "{n} item",
    itemsPlural: "{n} items",
    noListingsFound: "No listings found",
    tryAdjustingFilters: "Try adjusting your filters",
    postListing2: "Post a listing",
    allListingsLoaded: "All listings loaded",
    resultsFor: "Results for \"{q}\"",

    // ListingDetail page
    description: "Description",
    details: "Details",
    seller: "Seller",
    contactVia: "Contact via",
    reportListing: "Report this listing",
    deleteListing: "Delete listing?",
    deleteConfirm: "This will remove the listing from the marketplace. You won't be able to undo this action.",
    delete: "Delete listing",
    cancel: "Cancel",
    reportSubmitted: "Report submitted",
    reportThanks: "Thank you for helping keep the marketplace safe.",
    close: "Close",
    reportListing2: "Report listing",
    reportAdditionalDetails: "Additional details (optional)",
    submitting: "Submitting…",
    submitReport: "Submit report",
    markAsSold: "Mark as Sold",
    soldToTitle: "Who did you sell to?",
    soldToSubtitle: "Select the buyer to enable ratings for both parties.",
    soldToConfirm: "Confirm sale",
    soldToSkip: "Sold outside the app",
    markAsReserved: "Mark as Reserved",
    removeReservation: "Remove Reservation",
    relistActive: "Relist (mark as active)",
    renewListing: "Renew Listing",
    expiredNote: "This listing has expired and is no longer visible to buyers. Renew it to make it active again.",
    editListing: "Edit Listing",
    priceNegotiable: "Price negotiable",
    noLongerAvailable: "This item is no longer available",
    reservedNote: "This item is reserved. You can still send a message in case it becomes available.",
    logInToSend: "Log in to send message",
    sending2: "Sending...",
    sendMessage2: "Send message",
    listedAgo: "Listed {time}",
    viewCount: "{n} view",
    viewCountPlural: "{n} views",
    favoriteCount: "{n} like",
    favoriteCountPlural: "{n} likes",
    loginToContact: "Log in to contact the seller",

    // Report reasons
    reportSpam: "Spam or duplicate",
    reportOffensive: "Offensive or inappropriate",
    reportScam: "Scam or fraud",
    reportWrongCategory: "Wrong category",
    reportAlreadySold: "Already sold",
    reportOther: "Other",

    // Condition / Status
    statusAvailable: "Available",
    statusSold: "Sold",
    statusReserved: "Reserved",
    statusInactive: "Inactive",
    statusExpired: "Expired",

    // Settings / Edit profile
    settingsTitle: "Edit Profile",
    profilePicture: "Profile picture",
    profilePictureHint: "JPG, PNG or WebP · Max 5 MB",
    uploadingAvatar: "Uploading…",
    changeAvatar: "Change",
    uploadAvatar: "Upload",
    removeAvatar: "Remove",
    avatarUpdated: "Profile picture updated",
    avatarRemoved: "Profile picture removed",
    failedToUploadAvatar: "Failed to upload picture",
    failedToRemoveAvatar: "Failed to remove picture",
    fieldFullName: "Full name",
    fieldLocation: "Location",
    selectArea: "Select area…",
    fieldEmail: "Email address",
    emailChangeHint: "Contact support to change your email address.",
    communications: "Communications",
    phonePlaceholder: "Phone",
    whatsappPlaceholder: "WhatsApp",
    publicLabel: "Public",
    phonePublicTooltip: "Show this number on your profile and listings so buyers can call you.",
    whatsappPublicTooltip: "Show this number on your profile and listings so buyers can reach you on WhatsApp.",
    sameForWhatsapp: "Same for WhatsApp",
    spokenHeader: "Spoken",
    spokenTooltip: "Languages you speak — shown on your profile and listings so buyers can contact you in their preferred language.",
    spokenRequired: "Please select at least one language.",
    siteHeader: "Site",
    siteTooltip: "Use this language for the website interface.",
    profileUpdated: "Profile updated",
    failedToSaveProfile: "Failed to save changes",

    // Messages page
    messagesTitle: "Messages",
    noConversations: "No conversations yet.",
    noConversationsHint: "Find something you like and send a message to the seller.",
    unknownUser: "Unknown",
    listingLabel: "Listing",
    withSeller: "with",
    sellerLabel: "Seller",
    buyerLabel: "Buyer",
    typeMessage: "Type a message...",
    selectConversation: "Select a conversation",
    failedToSendMsg: "Failed to send",

    // Toast messages
    listingDeleted: "Listing deleted",
    markedAsSold: "Marked as sold",
    markedAsReserved: "Marked as reserved",
    markedAsActive: "Listing is active again",
    listingRenewed: "Listing renewed — active for another 30 days",
    failedToSendMessage: "Failed to send message",
    failedToSubmitReport: "Failed to submit report",

    // Create/Edit listing
    createListing: "Create New Listing",
    editListing2: "Edit Listing",
    fieldTitle: "Title",
    fieldCategory: "Category",
    fieldCondition: "Condition",
    fieldPrice: "Price (AWG)",
    fieldDescription: "Description",
    fieldPhotos: "Photos",
    categoryHint: "Can't find a category? Select \"Other\" and describe the item in the description field.",
    conditionGuide: "Condition guide",
    condNew2: "Unused, in original packaging",
    condLikeNew2: "Used once or twice, no visible wear",
    condGood2: "Normal use, minor signs of wear",
    condFair2: "Visible wear but fully functional",
    condPoor2: "Heavy wear or needs repair",
    freeLabel: "Free",
    negotiableLabel: "Negotiable",
    photoTips: "Photo tips",
    photoTip1: "Recommended: 1200 × 900 px (4:3 ratio)",
    photoTip2: "Max file size: 5 MB per photo",
    photoTip3: "Formats: JPG, PNG, WebP",
    photoTip4: "First photo is used as the thumbnail",
    dragToReorder: "Drag photos to reorder. First photo is used as the thumbnail.",
    thumbnail: "Thumbnail",
    addPhoto: "Add photo",
    listingExpiry: "Listings expire after 30 days.",
    listingExpiryHint: "Mark your item as sold or relist it to keep it active.",
    saveChanges: "Save Changes",
    uploading: "Uploading...",
    saving: "Saving...",
    searchCategories: "Search categories…",
    sortPopularTitle: "Sort: Most Popular (click for A–Z)",
    sortAZTitle: "Sort: A–Z (click for Most Popular)",
    titleRequired: "Title is required",
    categoryRequired: "Please select a category",
    priceRequired: "Price is required",
    priceMustBePositive: "Must be 0 or more",
    priceMax: "Maximum price is ƒ9,999,999",
    descriptionRequired: "Description is required",
    descriptionMaxLength: "Maximum 500 characters",
    descriptionPlaceholder: "Describe your item — size, brand, reason for selling...",
    maxPhotos: "Maximum 10 photos",
    failedToRemoveImage: "Failed to remove image",
    failedToUpload: "Failed to upload {name}",
    addAtLeastOnePhoto: "Please add at least one photo",
    listingUpdated: "Listing updated!",
    listingCreated: "Listing created!",
    failedToSaveListing: "Failed to save listing",

    // Category alerts
    alerts: "Alerts",
    alertsTitle: "Category Alerts",
    alertsHint: "Select the categories you want to watch. You'll receive a daily email digest of new listings in those categories.",
    alertsNoneSelected: "No categories selected",
    alertsCount: "{n} categories selected",
    saveAlerts: "Save alerts",
    alertsSaved: "Alerts saved!",
    alertsSaveFailed: "Failed to save alerts",
    alertsClearAll: "Reset alerts",
    loading: "Loading…",

    // Ratings
    rateUser: "Rate this person",
    ratingDescription: "Description accuracy",
    ratingCommunication: "Communication",
    ratingExchange: "Exchange / meetup",
    ratingOverall: "Overall experience",
    ratingSkip: "Skip",
    ratingSubmit: "Submit rating",
    ratingSaved: "Rating submitted!",
    ratingFailed: "Failed to submit rating",
    ratingsReceived: "ratings",
    sellerRatings: "Seller ratings",
    buyerRating: "Buyer rating",
  },

  es: {
    // Header
    sell: "Vender",
    messages: "Mensajes",
    profile: "Perfil",
    logIn: "Iniciar sesión",
    signUp: "Registrarse",
    logOut: "Cerrar sesión",
    searchPlaceholder: "Buscar anuncios...",
    sellSomething: "Vender algo",

    // Home – hero
    heroBadge: "El mercado local de Aruba",
    heroTitle: "Marketplace",
    heroSubtitle: "Compra y vende cualquier cosa localmente en la isla.\nSin comisiones, sin complicaciones — solo grandes ofertas.",
    postListing: "Publicar anuncio",
    browseListings: "Ver anuncios",

    // Home – stats
    activeListings: "Anuncios activos",
    registeredSellers: "Vendedores registrados",
    zeroFees: "Sin comisiones, siempre",

    // Home – categories
    shopByCategory: "Comprar por categoría",
    viewAll: "Ver todo",
    showAllCategories: "Ver las {n} categorías",
    showLess: "Ver menos",

    // Home – sections
    recentlyAdded: "Recién añadidos",
    mostPopular: "Más populares",
    howItWorks: "Cómo funciona",
    noListingsYet: "Aún no hay anuncios",
    beFirstToSell: "Sé el primero en vender algo en Marketplace.aw",

    // How it works steps
    step1Title: "Crea una cuenta gratis",
    step1Desc: "Regístrate en segundos. Sin tarjeta de crédito, sin suscripción — es completamente gratis.",
    step2Title: "Publica tu artículo",
    step2Desc: "Agrega fotos, fija tu precio y llega a compradores en toda Aruba en minutos.",
    step3Title: "Chatea y cierra el trato",
    step3Desc: "Escríbele al comprador, acuerda un precio y queden en persona.",

    // Footer
    arubaMarketplace: "El mercado local de Aruba",
    contactUs: "Contáctanos",

    // Login
    welcomeBack: "Bienvenido de nuevo",
    email: "Correo electrónico",
    password: "Contraseña",
    signingIn: "Iniciando sesión...",
    signIn: "Iniciar sesión",
    forgotPassword: "¿Olvidaste tu contraseña?",
    noAccount: "¿No tienes una cuenta?",

    // Register
    createAccount: "Crea tu cuenta",
    fullName: "Nombre completo",
    creating: "Creando cuenta...",
    alreadyHaveAccount: "¿Ya tienes una cuenta?",
    passwordHint: "Mín. 8 caracteres, mayúscula, minúscula, número",

    // ForgotPassword
    forgotPasswordTitle: "¿Olvidaste tu contraseña?",
    forgotPasswordSub: "Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.",
    sendResetLink: "Enviar enlace",
    sending: "Enviando...",
    backToSignIn: "Volver a iniciar sesión",
    resetEmailSent: "Si ese correo está registrado, te hemos enviado un enlace. Revisa tu bandeja de entrada.",

    // Profile
    listings: "Anuncios",
    sold: "Vendidos",
    favorites: "Favoritos",
    noListings: "Aún no hay anuncios.",
    listFirstItem: "Publica tu primer artículo",
    noSoldItems: "Aún no hay artículos vendidos.",
    noExpiredListings: "No hay anuncios caducados.",
    expiredTabHint: "Estos anuncios han caducado y ya no son visibles para los compradores. Renuévalos para activarlos de nuevo.",
    noFavorites: "Aún no hay favoritos.",
    heartToSave: "Dale corazón a un anuncio para guardarlo aquí.",
    editProfile: "Editar perfil",
    relist: "Volver a publicar",
    joined: "Se unió en",

    // ListingCard
    free: "Gratis",
    reserved: "Reservado",

    // Condition labels
    condNew: "Nuevo",
    condLikeNew: "Como nuevo",
    condGood: "Bueno",
    condFair: "Regular",
    condPoor: "Malo",

    // Contact
    contactTitle: "Contáctanos",
    contactSub: "Normalmente respondemos en 1 día hábil.",
    name: "Nombre",
    subject: "Asunto",
    message: "Mensaje",
    sendMessage: "Enviar mensaje",
    messageSent: "¡Mensaje enviado!",
    messageSentSub: "Gracias por escribirnos. Te responderemos lo antes posible.",
    backToHome: "Volver al inicio",

    // Settings / Profile — languages
    languagesSpoken: "Idiomas hablados",
    langEnglish: "Inglés",
    langSpanish: "Español",
    langPapiamento: "Papiamento",
    langDutch: "Holandés",

    // Listings page
    allListings: "Todos los anuncios",
    categories: "Categorías",
    sortLabel: "Ordenar:",
    filterLabel: "Filtrar:",
    sortDate: "Fecha",
    sortPrice: "Precio",
    sortPopular: "Popular",
    filterLocation: "Ubicación",
    filterCondition: "Estado",
    filterPrice: "Precio",
    freeItemsOnly: "Solo artículos gratis",
    anyLocation: "Cualquier ubicación",
    anyCondition: "Cualquier estado",
    priceRange: "Rango de precio (AWG)",
    clearFilters: "Limpiar filtros",
    items: "{n} artículo",
    itemsPlural: "{n} artículos",
    noListingsFound: "No se encontraron anuncios",
    tryAdjustingFilters: "Intenta ajustar los filtros",
    postListing2: "Publicar anuncio",
    allListingsLoaded: "Todos los anuncios cargados",
    resultsFor: "Resultados para \"{q}\"",

    // ListingDetail page
    description: "Descripción",
    details: "Detalles",
    seller: "Vendedor",
    contactVia: "Contactar por",
    reportListing: "Reportar este anuncio",
    deleteListing: "¿Eliminar anuncio?",
    deleteConfirm: "Esto eliminará el anuncio del marketplace. No podrás deshacer esta acción.",
    delete: "Eliminar anuncio",
    cancel: "Cancelar",
    reportSubmitted: "Reporte enviado",
    reportThanks: "Gracias por ayudar a mantener el marketplace seguro.",
    close: "Cerrar",
    reportListing2: "Reportar anuncio",
    reportAdditionalDetails: "Detalles adicionales (opcional)",
    submitting: "Enviando…",
    submitReport: "Enviar reporte",
    markAsSold: "Marcar como vendido",
    soldToTitle: "¿A quién le vendiste?",
    soldToSubtitle: "Selecciona el comprador para habilitar valoraciones para ambas partes.",
    soldToConfirm: "Confirmar venta",
    soldToSkip: "Vendido fuera de la app",
    markAsReserved: "Marcar como reservado",
    removeReservation: "Quitar reserva",
    relistActive: "Volver a publicar (marcar activo)",
    renewListing: "Renovar anuncio",
    expiredNote: "Este anuncio ha caducado y ya no es visible para los compradores. Renuévalo para activarlo de nuevo.",
    editListing: "Editar anuncio",
    priceNegotiable: "Precio negociable",
    noLongerAvailable: "Este artículo ya no está disponible",
    reservedNote: "Este artículo está reservado. Puedes enviar un mensaje por si queda disponible.",
    logInToSend: "Inicia sesión para enviar un mensaje",
    sending2: "Enviando...",
    sendMessage2: "Enviar mensaje",
    listedAgo: "Publicado hace {time}",
    viewCount: "{n} vista",
    viewCountPlural: "{n} vistas",
    favoriteCount: "{n} me gusta",
    favoriteCountPlural: "{n} me gusta",
    loginToContact: "Inicia sesión para contactar al vendedor",

    // Report reasons
    reportSpam: "Spam o duplicado",
    reportOffensive: "Ofensivo o inapropiado",
    reportScam: "Estafa o fraude",
    reportWrongCategory: "Categoría incorrecta",
    reportAlreadySold: "Ya vendido",
    reportOther: "Otro",

    // Condition / Status
    statusAvailable: "Disponible",
    statusSold: "Vendido",
    statusReserved: "Reservado",
    statusInactive: "Inactivo",
    statusExpired: "Caducado",

    // Settings / Edit profile
    settingsTitle: "Editar perfil",
    profilePicture: "Foto de perfil",
    profilePictureHint: "JPG, PNG o WebP · Máx 5 MB",
    uploadingAvatar: "Subiendo…",
    changeAvatar: "Cambiar",
    uploadAvatar: "Subir",
    removeAvatar: "Eliminar",
    avatarUpdated: "Foto de perfil actualizada",
    avatarRemoved: "Foto de perfil eliminada",
    failedToUploadAvatar: "No se pudo subir la foto",
    failedToRemoveAvatar: "No se pudo eliminar la foto",
    fieldFullName: "Nombre completo",
    fieldLocation: "Ubicación",
    selectArea: "Selecciona área…",
    fieldEmail: "Correo electrónico",
    emailChangeHint: "Contacta con soporte para cambiar tu correo.",
    communications: "Comunicaciones",
    phonePlaceholder: "Teléfono",
    whatsappPlaceholder: "WhatsApp",
    publicLabel: "Público",
    phonePublicTooltip: "Muestra este número en tu perfil y anuncios para que los compradores puedan llamarte.",
    whatsappPublicTooltip: "Muestra este número en tu perfil y anuncios para que los compradores te contacten por WhatsApp.",
    sameForWhatsapp: "Igual para WhatsApp",
    spokenHeader: "Hablado",
    spokenTooltip: "Idiomas que hablas — se muestran en tu perfil y anuncios para que los compradores puedan contactarte en su idioma preferido.",
    spokenRequired: "Por favor selecciona al menos un idioma.",
    siteHeader: "Sitio",
    siteTooltip: "Usa este idioma para la interfaz del sitio web.",
    profileUpdated: "Perfil actualizado",
    failedToSaveProfile: "No se pudieron guardar los cambios",

    // Messages page
    messagesTitle: "Mensajes",
    noConversations: "Aún no hay conversaciones.",
    noConversationsHint: "Encuentra algo que te guste y envía un mensaje al vendedor.",
    unknownUser: "Desconocido",
    listingLabel: "Anuncio",
    withSeller: "con",
    sellerLabel: "Vendedor",
    buyerLabel: "Comprador",
    typeMessage: "Escribe un mensaje...",
    selectConversation: "Selecciona una conversación",
    failedToSendMsg: "No se pudo enviar",

    // Toast messages
    listingDeleted: "Anuncio eliminado",
    markedAsSold: "Marcado como vendido",
    markedAsReserved: "Marcado como reservado",
    markedAsActive: "El anuncio está activo de nuevo",
    listingRenewed: "Anuncio renovado — activo por otros 30 días",
    failedToSendMessage: "No se pudo enviar el mensaje",
    failedToSubmitReport: "No se pudo enviar el reporte",

    // Create/Edit listing
    createListing: "Crear nuevo anuncio",
    editListing2: "Editar anuncio",
    fieldTitle: "Título",
    fieldCategory: "Categoría",
    fieldCondition: "Estado",
    fieldPrice: "Precio (AWG)",
    fieldDescription: "Descripción",
    fieldPhotos: "Fotos",
    categoryHint: "¿No encuentras una categoría? Selecciona \"Otro\" y descríbelo en la descripción.",
    conditionGuide: "Guía de estado",
    condNew2: "Sin usar, en embalaje original",
    condLikeNew2: "Usado una o dos veces, sin desgaste visible",
    condGood2: "Uso normal, desgaste menor",
    condFair2: "Desgaste visible pero funciona perfectamente",
    condPoor2: "Desgaste severo o necesita reparación",
    freeLabel: "Gratis",
    negotiableLabel: "Negociable",
    photoTips: "Consejos para fotos",
    photoTip1: "Recomendado: 1200 × 900 px (relación 4:3)",
    photoTip2: "Tamaño máx.: 5 MB por foto",
    photoTip3: "Formatos: JPG, PNG, WebP",
    photoTip4: "La primera foto se usa como miniatura",
    dragToReorder: "Arrastra las fotos para reordenarlas. La primera se usa como miniatura.",
    thumbnail: "Miniatura",
    addPhoto: "Agregar foto",
    listingExpiry: "Los anuncios caducan después de 30 días.",
    listingExpiryHint: "Márcalo como vendido o vuelve a publicarlo para mantenerlo activo.",
    saveChanges: "Guardar cambios",
    uploading: "Subiendo...",
    saving: "Guardando...",
    searchCategories: "Buscar categorías…",
    sortPopularTitle: "Ordenar: Más populares (click para A–Z)",
    sortAZTitle: "Ordenar: A–Z (click para Más populares)",
    titleRequired: "El título es obligatorio",
    categoryRequired: "Por favor selecciona una categoría",
    priceRequired: "El precio es obligatorio",
    priceMustBePositive: "Debe ser 0 o más",
    priceMax: "Precio máximo: ƒ9.999.999",
    descriptionRequired: "La descripción es obligatoria",
    descriptionMaxLength: "Máximo 500 caracteres",
    descriptionPlaceholder: "Describe el artículo — talla, marca, motivo de venta...",
    maxPhotos: "Máximo 10 fotos",
    failedToRemoveImage: "No se pudo eliminar la imagen",
    failedToUpload: "No se pudo subir {name}",
    addAtLeastOnePhoto: "Por favor agrega al menos una foto",
    listingUpdated: "¡Anuncio actualizado!",
    listingCreated: "¡Anuncio creado!",
    failedToSaveListing: "No se pudo guardar el anuncio",

    // Category alerts
    alerts: "Alertas",
    alertsTitle: "Alertas por categoría",
    alertsHint: "Selecciona las categorías que quieres seguir. Recibirás un resumen diario por email con los nuevos anuncios en esas categorías.",
    alertsNoneSelected: "No hay categorías seleccionadas",
    alertsCount: "{n} categorías seleccionadas",
    saveAlerts: "Guardar alertas",
    alertsSaved: "¡Alertas guardadas!",
    alertsSaveFailed: "No se pudieron guardar las alertas",
    alertsClearAll: "Restablecer alertas",
    loading: "Cargando…",

    // Ratings
    rateUser: "Califica a esta persona",
    ratingDescription: "Exactitud de la descripción",
    ratingCommunication: "Comunicación",
    ratingExchange: "Intercambio / encuentro",
    ratingOverall: "Experiencia general",
    ratingSkip: "Omitir",
    ratingSubmit: "Enviar calificación",
    ratingSaved: "¡Calificación enviada!",
    ratingFailed: "No se pudo enviar la calificación",
    ratingsReceived: "valoraciones",
    sellerRatings: "Valoraciones como vendedor",
    buyerRating: "Valoración como comprador",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Translations = typeof translations.en;

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang, persist?: boolean) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const stored = (localStorage.getItem("lang") ?? "en") as Lang;
  const [lang, setLangState] = useState<Lang>(stored === "es" ? "es" : "en");

  const setLang = (l: Lang, persist = true) => {
    if (persist) localStorage.setItem("lang", l);
    setLangState(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
