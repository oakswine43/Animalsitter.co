// js/state.js
// Central in-memory state + role definitions for PetCare Portal
// Now includes localStorage persistence + real signup/login support.

window.PetCareState = (function () {
  // --- Role definitions / permissions metadata ---

  const ROLE_DEFINITIONS = {
    client: {
      key: "client",
      label: "Regular User (Client / Pet Owner)",
      description:
        "A Regular User is someone who creates an account to book dog sitters, browse nearby sitters, view profiles, and manage their pet-care needs.",
      permissions: [
        "Create an account & log in",
        "Create a pet profile (name, breed, age, special needs)",
        "Browse sitters through a swipe-style interface or a map view",
        "View sitter profiles (rates, reviews, distance, availability)",
        "Match / save sitters they like to a favorites list",
        "Send messages to sitters they matched with",
        "Book services: dog sitting, dog walking, overnight stays, drop-ins",
        "Schedule appointments with available times",
        "Make payments securely through the platform",
        "Leave reviews and ratings for completed bookings",
        "Edit account information (email, phone, password)",
        "Edit pet details and address",
        "Receive notifications for messages, confirmations, reminders, updates",
        "Cancel or modify bookings (depending on sitter’s cancellation policy)"
      ],
      restrictions: [
        "Cannot access admin tools",
        "Cannot view private sitter details (such as address) until booking is confirmed",
        "Cannot modify sitter profiles",
        "Cannot see employee-only dashboards"
      ]
    },

    sitter: {
      key: "sitter",
      label: "Sitter",
      description: "Provides pet-care services through the platform.",
      permissions: [
        "Create and manage a sitter profile",
        "Upload photos, certifications, and ID verification",
        "Set bio, experience, and skills",
        "Add preferred dog sizes, breeds, and behavior requirements",
        "Set location radius or service area",
        "Toggle availability (online/offline)",
        "Create service listings (sitting, walking, drop-ins, overnight)",
        "Set custom prices and extra fees",
        "Accept or decline booking requests",
        "View client profiles and pet details",
        "View booking calendar and upcoming appointments",
        "Modify bookings (reschedule or request changes)",
        "Mark bookings as Completed",
        "Chat with clients and send updates/photos",
        "Receive payments and view payout history",
        "Access basic sales reports (weekly/monthly earnings)",
        "View client reviews and reply",
        "Report suspicious or harmful reviews",
        "Receive notifications for matches, bookings, payments, reminders, and safety alerts"
      ],
      restrictions: [
        "Cannot access admin dashboards",
        "Cannot edit client account information",
        "Cannot view private client home address until a booking is accepted",
        "Cannot change platform fees or payout policies",
        "Cannot access confidential admin financial tools"
      ]
    },

    employee: {
      key: "employee",
      label: "Employee (Support Staff)",
      description:
        "Handles support, safety checks, verifications, disputes, and moderation without full admin power.",
      permissions: [
        "View client and sitter accounts",
        "Assist with password resets and login issues",
        "Review sitter applications and approve/deny them",
        "Verify sitter documents (ID, background, certifications)",
        "Handle disputes between sitters and clients",
        "Resolve payment issues or booking conflicts",
        "View all bookings on the platform",
        "Help modify, cancel, or refund bookings when needed",
        "Contact sitters or clients about upcoming appointment issues",
        "Access internal support dashboard and respond to tickets",
        "Send messages/alerts to users about safety or booking concerns",
        "Flag suspicious activity and report to Admin",
        "View payment logs, payout statuses, and transaction history",
        "Generate basic reports (weekly activity, support volume, flagged accounts)",
        "Review user-reported content",
        "Moderate inappropriate photos, descriptions, or messages",
        "Suspend or temporarily restrict accounts pending admin review",
        "Manage reviews (remove fraudulent or abusive ones)"
      ],
      restrictions: [
        "Cannot delete entire accounts permanently",
        "Cannot change platform-wide settings",
        "Cannot edit admin-level permissions",
        "Cannot adjust platform fees or service pricing",
        "Cannot access confidential admin financial tools",
        "Cannot push app updates or modify code"
      ]
    },

    admin: {
      key: "admin",
      label: "Admin",
      description: "Has full control over the platform.",
      permissions: [
        "All employee permissions",
        "Create, edit, and delete any user account",
        "Change platform-wide settings and fees",
        "Access full financial and analytics dashboards"
      ],
      restrictions: []
    },

    guest: {
      key: "guest",
      label: "Guest",
      description: "Read-only preview user, no account required.",
      permissions: [],
      restrictions: []
    }
  };

  // --- Storage ---

  const STORAGE_KEY = "petcare_state_v1";

  function saveToStorage() {
    try {
      const payload = {
        currentUser: state.currentUser,
        users: state.users,
        sitterProfiles: state.sitterProfiles,
        bookings: state.bookings,
        messages: state.messages,
        pets: state.pets
        // we intentionally do not persist ui
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("PetCareState: failed to save.", e);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);

      state.currentUser = parsed.currentUser || null;
      state.users = Array.isArray(parsed.users) ? parsed.users : [];
      state.sitterProfiles = Array.isArray(parsed.sitterProfiles)
        ? parsed.sitterProfiles
        : [];
      state.bookings = Array.isArray(parsed.bookings) ? parsed.bookings : [];
      state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      state.pets = Array.isArray(parsed.pets) ? parsed.pets : [];

      // Normalize missing status fields
      state.users.forEach((u) => {
        if (!u.status) u.status = "active";
      });

      return true;
    } catch (e) {
      console.warn("PetCareState: failed to load.", e);
      return false;
    }
  }

  // --- In-memory data/state ---

  const state = {
    currentUser: null,
    users: [],
    sitterProfiles: [],
    bookings: [],
    messages: [],
    pets: [],

    ui: {
      selectedSitterId: null
    }
  };

  // Seed sample data so UI has something to show
  function seedDemoData() {
    // USERS
    state.users = [
      // --- ADMIN ---
      {
        id: "u-admin",
        name: "Alex Admin",
        email: "admin@demo.com",
        password: "admin123",
        role: "admin",
        status: "active"
      },

      // --- EMPLOYEE ---
      {
        id: "u-employee1",
        name: "Evan Employee",
        email: "employee@demo.com",
        password: "employee123",
        role: "employee",
        status: "active"
      },

      // --- SITTERS ---
      {
        id: "u-sitter1",
        name: "Sam Sitter",
        email: "sitter@demo.com",
        password: "sitter123",
        role: "sitter",
        status: "active"
      },
      {
        id: "u-sitter2",
        name: "Taylor Paws",
        email: "taylor@demo.com",
        password: "sitter123",
        role: "sitter",
        status: "active"
      },
      {
        id: "u-sitter3",
        name: "Jordan Walker",
        email: "jordan@demo.com",
        password: "sitter123",
        role: "sitter",
        status: "active"
      },

      // --- CLIENTS ---
      {
        id: "u-client1",
        name: "Cora Client",
        email: "client@demo.com",
        password: "client123",
        role: "client",
        status: "active"
      },
      {
        id: "u-client2",
        name: "Brandon Barker",
        email: "brandon@demo.com",
        password: "client123",
        role: "client",
        status: "active"
      }
    ];

    // SITTER PROFILES
    state.sitterProfiles = [
      {
        id: "u-sitter1",
        name: "Sam Sitter",
        city: "Knoxville, TN",
        distance: "1.2 mi",
        rating: 4.9,
        reviewsCount: 42,
        tagline: "High-energy walks & cuddle reports every visit.",
        avatar:
          "https://images.pexels.com/photos/5731865/pexels-photo-5731865.jpeg?auto=compress&cs=tinysrgb&w=400",

        location: "Knoxville, TN (within 10 miles)",
        experience: 5,
        bio:
          "Hey! I’m Sam. I’ve been a pet sitter for 5+ years and specialize in high-energy breeds. I love hiking, fetch sessions, and keeping pups mentally stimulated.",
        reviewSnippet:
          "“Sam sent daily photo updates and took Milo on long walks!”",

        age: 29,
        availability: "Mon–Fri • 8:00am – 6:00pm",
        serviceRadius: "Up to 10 miles from Knoxville",
        serviceAreaMapLabel: "Knoxville downtown & nearby parks",

        skills: [
          "Pet CPR/First Aid certified",
          "Administering oral & topical meds",
          "Handling anxious or reactive dogs",
          "Puppy care & potty training support",
          "Senior dog care and slow walks",
          "Basic leash & obedience training"
        ],

        services: [
          {
            icon: "🏠",
            name: "In-Home Sitting",
            price: "$40/night",
            duration: "Overnight stay",
            notes: "Includes walks, feeding, meds, and photo updates."
          },
          {
            icon: "🚶",
            name: "Dog Walking",
            price: "$20",
            duration: "30 minutes",
            notes:
              "Neighborhood walks with GPS tracking and a quick report."
          },
          {
            icon: "🐕",
            name: "Drop-In Visit",
            price: "$25",
            duration: "30–45 minutes",
            notes:
              "Let-outs, food/water refill, and playtime."
          },
          {
            icon: "🛁",
            name: "Bathing/Grooming Add-on",
            price: "$15",
            duration: "15–20 minutes",
            notes: "Light bath & brush after walks or before pickup."
          }
        ],

        experienceYears: 5,
        pastJobs: ["Local rescue volunteer", "Neighborhood dog walker"],
        breedsHandled: [
          "Labs & Retrievers",
          "German Shepherds",
          "Pitbull mixes",
          "Doodles",
          "Small breeds (Chihuahuas, Yorkies)"
        ],
        specialCases: [
          "Rescue dogs with fear issues",
          "Medication schedules",
          "Post-surgery crate rest"
        ],

        reviews: [
          {
            rating: 5,
            clientName: "Chris & Milo",
            comment:
              "Sam was amazing! Tons of photo updates and Milo came back happy and tired.",
            photo:
              "https://images.pexels.com/photos/5731865/pexels-photo-5731865.jpeg?auto=compress&cs=tinysrgb&w=400"
          },
          {
            rating: 4.8,
            clientName: "Taylor & Luna",
            comment:
              "Great with our high-energy husky. Very communicative and punctual."
          }
        ],

        gallery: [
          "https://images.pexels.com/photos/5731865/pexels-photo-5731865.jpeg?auto=compress&cs=tinysrgb&w=400",
          "https://images.pexels.com/photos/7210260/pexels-photo-7210260.jpeg?auto=compress&cs=tinysrgb&w=400"
        ],

        homeSetup: {
          fencedYard: true,
          otherPets: "1 friendly golden retriever",
          dogSizesAccepted: "Dogs up to ~80 lbs",
          childrenInHome: "No children in the home",
          crateOptions: "Crates available if needed",
          sleepingArrangements:
            "Dogs can sleep in the bedroom or living room depending on owner preference."
        },

        policies: {
          cancellation:
            "Free cancellation up to 24 hours before start. 50% after that.",
          meetAndGreet: "Meet & greet required for all new dogs.",
          aggressiveDogs:
            "Not able to accept dogs with a history of biting people.",
          extraFees:
            "Holiday bookings +$10/night. Last-minute bookings (<24h) +$5."
        },

        badges: [
          "Identity verified",
          "Background check completed",
          "Pet CPR/First Aid certified"
        ],

        availabilityCalendarNote:
          "Weekdays mostly open. Weekends book up 1–2 weeks in advance.",

        prompts: {
          favoriteBreed:
            "Honestly? Mutts and rescues – they’ve got the best stories.",
          walkHabit:
            "I always end walks with a quick water break and photo.",
          dogsLoveMeBecause:
            "I match their energy – zoomies when they want to play, calm cuddles when they’re tired.",
          superpower: "I can tire out even the zoomiest husky."
        },

        introVideoUrl: "",
        compatibilityScore: 96
      },

      {
        id: "u-sitter2",
        name: "Taylor Paws",
        city: "Oak Ridge, TN",
        distance: "3.4 mi",
        rating: 4.8,
        reviewsCount: 31,
        tagline: "Anxious pups & senior dogs are my specialty.",
        avatar:
          "https://images.pexels.com/photos/4588060/pexels-photo-4588060.jpeg?auto=compress&cs=tinysrgb&w=400",

        location: "Oak Ridge, TN (within 8 miles)",
        experience: 7,
        bio:
          "Hi, I’m Taylor. I focus on anxious and senior dogs, making sure they feel safe, loved, and unrushed.",
        reviewSnippet:
          "“Taylor was so gentle with our senior dog and sent thoughtful updates.”",

        age: 32,
        availability: "Mon–Sun • 7:00am – 8:00pm",
        serviceRadius: "Up to 8 miles from Oak Ridge",
        serviceAreaMapLabel: "Oak Ridge neighborhoods & local greenways",

        skills: [
          "Senior dog care",
          "Administering meds (pills & injections)",
          "Handling anxious/shy dogs",
          "Gentle grooming & brushing",
          "Slow, low-impact walks"
        ],

        services: [
          {
            icon: "🏠",
            name: "In-Home Sitting",
            price: "$45/night",
            duration: "Overnight stay",
            notes:
              "Perfect for seniors who need a calm, consistent presence."
          },
          {
            icon: "🚶",
            name: "Gentle Walks",
            price: "$18",
            duration: "20–25 minutes",
            notes:
              "Shorter, slow-paced walks for older or low-energy pups."
          },
          {
            icon: "🐕",
            name: "Drop-In Check",
            price: "$22",
            duration: "20–30 minutes",
            notes:
              "Bathroom break, fresh water, meds, and cuddles."
          }
        ],

        experienceYears: 7,
        pastJobs: ["Vet tech assistant", "Rescue foster home"],
        breedsHandled: ["Spaniels", "Terriers", "Senior large breeds"],
        specialCases: [
          "Arthritis and mobility issues",
          "Post-surgery care",
          "Anxious dogs who need slow introductions"
        ],

        reviews: [
          {
            rating: 5,
            clientName: "Morgan & Daisy",
            comment:
              "Taylor treated our 14-year-old Daisy like royalty. Slow walks, meds on time, and so much patience."
          }
        ],

        gallery: [
          "https://images.pexels.com/photos/4588012/pexels-photo-4588012.jpeg?auto=compress&cs=tinysrgb&w=400"
        ],

        homeSetup: {
          fencedYard: false,
          otherPets: "Calm senior beagle",
          dogSizesAccepted: "Small–medium breeds preferred",
          childrenInHome: "No children",
          crateOptions: "Can use owner-provided crate if needed",
          sleepingArrangements:
            "Dogs can sleep on dog beds in the living room."
        },

        policies: {
          cancellation:
            "Free cancellation up to 48 hours before start. 50% after.",
          meetAndGreet: "Strongly recommended for all new bookings.",
          aggressiveDogs:
            "Cannot accept dogs with a bite history or who are aggressive toward other dogs.",
          extraFees: "Holiday bookings +$8/night."
        },

        badges: ["Identity verified", "Background check completed"],

        availabilityCalendarNote:
          "Most weekdays open, holidays fill up quickly – book early!",

        prompts: {
          favoriteBreed: "Senior beagles – I’m biased because of my own.",
          walkHabit: "We always stop to sniff the flowers and take our time.",
          dogsLoveMeBecause:
            "I never rush them and always respect their boundaries.",
          superpower: "Turning stressed pups into relaxed, sleepy puddles."
        },

        introVideoUrl: "",
        compatibilityScore: 93
      },

      {
        id: "u-sitter3",
        name: "Jordan Walker",
        city: "Farragut, TN",
        distance: "6.1 mi",
        rating: 5.0,
        reviewsCount: 19,
        tagline: "Daily photo updates and GPS-tracked walks.",
        avatar:
          "https://images.pexels.com/photos/7210260/pexels-photo-7210260.jpeg?auto=compress&cs=tinysrgb&w=400",

        location: "Farragut, TN (within 12 miles)",
        experience: 4,
        bio:
          "What’s up! I’m Jordan. I love active dogs, long walks, and sending cool photo updates from our adventures.",
        reviewSnippet:
          "“Jordan wore our doodle out in the best way and sent awesome pics.”",

        age: 26,
        availability: "Mon–Sat • 9:00am – 9:00pm",
        serviceRadius: "Up to 12 miles from Farragut",
        serviceAreaMapLabel: "Farragut, Concord Park, and greenways",

        skills: [
          "High-energy dog handling",
          "Trail & park walks",
          "Basic obedience reinforcement",
          "Crate training support"
        ],

        services: [
          {
            icon: "🚶",
            name: "Adventure Walks",
            price: "$25",
            duration: "45–60 minutes",
            notes:
              "Long walks or light jogs for high-energy pups."
          },
          {
            icon: "🏠",
            name: "In-Home Sitting",
            price: "$50/night",
            duration: "Overnight stay",
            notes:
              "Great for active dogs who need a lot of playtime."
          },
          {
            icon: "🐕",
            name: "Drop-In Visit",
            price: "$22",
            duration: "30 minutes",
            notes:
              "Let-out, feeding, and quick play session."
          }
        ],

        experienceYears: 4,
        pastJobs: ["Doggy daycare handler"],
        breedsHandled: [
          "Huskies",
          "Australian Shepherds",
          "Doodles",
          "High-energy mixed breeds"
        ],
        specialCases: ["Working with leash-pullers", "Young, energetic dogs"],

        reviews: [
          {
            rating: 5,
            clientName: "Alex & Koda",
            comment:
              "Koda came home tired and happy every time. Loved the GPS walk maps!"
          }
        ],

        gallery: [
          "https://images.pexels.com/photos/7210260/pexels-photo-7210260.jpeg?auto=compress&cs=tinysrgb&w=400"
        ],

        homeSetup: {
          fencedYard: true,
          otherPets: "No other pets",
          dogSizesAccepted: "All sizes welcome",
          childrenInHome: "No children",
          crateOptions: "Crates available on request",
          sleepingArrangements:
            "Dogs can sleep in the living room or bedroom if approved."
        },

        policies: {
          cancellation:
            "Free cancellation up to 24 hours before start. 50% after.",
          meetAndGreet:
            "Recommended for dogs over 60 lbs or very high energy.",
          aggressiveDogs:
            "Can’t host dogs with history of aggression toward people.",
          extraFees:
            "Holiday walks +$5; extra-long hikes priced case by case."
        },

        badges: ["Identity verified"],

        availabilityCalendarNote:
          "Evenings and Saturdays open; weekday afternoons limited.",

        prompts: {
          favoriteBreed: "Anything with zoomies and floppy ears.",
          walkHabit: "We always find a shady spot to rest and hydrate.",
          dogsLoveMeBecause:
            "I’m always ready to play fetch one more time… and then one more.",
          superpower: "Turning normal walks into mini adventures."
        },

        introVideoUrl: "",
        compatibilityScore: 95
      }
    ];

    state.bookings = [];
    state.messages = [];
    state.pets = [];
  }

  // --- Auth helpers ---

  function init() {
    // Load storage only once per page load
    if (init._didInit) return;
    init._didInit = true;

    const loaded = loadFromStorage();
    if (!loaded || !state.users.length) {
      seedDemoData();
      saveToStorage();
    }
  }

  function login(email, password) {
    init();
    if (!email || !password) return null;

    const user = state.users.find(
      (u) =>
        u.email &&
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password
    );

    if (user) {
      state.currentUser = { ...user };
      saveToStorage();
      return state.currentUser;
    }
    return null;
  }

  // Backward-compatible demo helper
  function quickLogin(role) {
    init();
    const user = state.users.find((u) => u.role === role);
    if (user) {
      state.currentUser = { ...user };
      saveToStorage();
      return state.currentUser;
    }
    return null;
  }

  function logout() {
    state.currentUser = { id: "guest", name: "Guest", role: "guest" };
    saveToStorage();
  }

  function getCurrentUser() {
    init();
    if (!state.currentUser) {
      return { id: "guest", name: "Guest", role: "guest" };
    }
    return state.currentUser;
  }

  function setCurrentUser(user) {
    init();
    state.currentUser = user || { id: "guest", name: "Guest", role: "guest" };
    saveToStorage();
  }

  function ensureDefaultUser() {
    // No auto-login. If nothing is set, lock to Guest.
    init();
    if (!state.currentUser) {
      state.currentUser = { id: "guest", name: "Guest", role: "guest" };
      saveToStorage();
    }
  }

  // ---------- registration helper for Sign Up ----------

  function registerUser({ name, email, password, role }) {
    init();
    if (!email) return null;

    const normalizedEmail = email.toLowerCase();

    // prevent duplicate accounts by email
    const existing = state.users.find(
      (u) => u.email && u.email.toLowerCase() === normalizedEmail
    );
    if (existing) return null;

    const newId = "u-" + (state.users.length + 1);

    const user = {
      id: newId,
      name: name || "New User",
      email,
      password: password || "",
      role: role || "client",
      status: "active"
    };

    state.users.push(user);
    state.currentUser = { ...user };

    // If they sign up as a sitter, create a basic sitter profile
    if (user.role === "sitter") {
      state.sitterProfiles.push({
        id: newId,
        name: user.name,
        city: "Unknown City",
        distance: "—",
        rating: 5.0,
        reviewsCount: 0,
        tagline: "New sitter – bio coming soon!",
        avatar:
          "https://images.pexels.com/photos/4588012/pexels-photo-4588012.jpeg?auto=compress&cs=tinysrgb&w=400"
      });
    }

    saveToStorage();
    return user;
  }

  // --- Data getters ---

  function getUsers() {
    init();
    return state.users.slice();
  }

  function getSitters() {
    init();
    return state.sitterProfiles.slice();
  }

  function getSitterById(id) {
    init();
    return state.sitterProfiles.find((s) => s.id === id) || null;
  }

  function getBookings() {
    init();
    return state.bookings.slice();
  }

  function getMessages() {
    init();
    return state.messages.slice();
  }

  function getPets() {
    init();
    return state.pets.slice();
  }

  // --- Pet helpers (add/edit dogs) ---

  function addPet(pet) {
    init();
    const idx = state.pets.length + 1;

    const newPet = {
      id: pet.id || "dog-" + idx,
      ownerId: pet.ownerId,
      name: pet.name || "",
      breed: pet.breed || "",
      ageYears: pet.ageYears || "",
      ageMonths: pet.ageMonths || "",
      weight: pet.weight || "",
      color: pet.color || "",
      aggression: pet.aggression || "",
      notes: pet.notes || ""
    };

    state.pets.push(newPet);
    saveToStorage();
    return newPet;
  }

  function updatePet(petId, updates) {
    init();
    if (!petId) return null;

    const pet = state.pets.find((p) => p.id === petId);
    if (!pet) return null;

    Object.assign(pet, updates);
    saveToStorage();
    return pet;
  }

  // --- UI helpers: sitter selection for profile page ---

  function setSelectedSitterId(id) {
    state.ui.selectedSitterId = id || null;
  }

  function getSelectedSitter() {
    init();
    const id = state.ui.selectedSitterId;
    if (!id) return null;
    return getSitterById(id);
  }

  // --- Role meta getters ---

  function getRoleDefinition(roleKey) {
    return ROLE_DEFINITIONS[roleKey] || null;
  }

  function getAllRoleDefinitions() {
    return ROLE_DEFINITIONS;
  }

  // --- Booking helper ---

  function createBooking(booking) {
    init();
    state.bookings.push(booking);
    saveToStorage();
    return booking;
  }

  function createAppointment(client, sitter, options) {
    init();
    const booking = {
      id: "b-" + (state.bookings.length + 1),
      clientId: client && client.id ? client.id : null,
      sitterId: sitter && sitter.id ? sitter.id : null,
      status: "requested",
      createdAt: new Date().toISOString(),
      date: options && options.date ? options.date : null,
      details: (options && options.details) || ""
    };

    state.bookings.push(booking);
    saveToStorage();
    return booking;
  }

  // --- Public API ---

  return {
    init,
    ensureDefaultUser,
    login,
    quickLogin,
    logout,
    getCurrentUser,
    setCurrentUser,

    // Sign Up
    registerUser,

    getUsers,
    getSitters,
    getSitterById,
    getBookings,
    getMessages,
    getPets,
    createBooking,
    createAppointment,

    getRoleDefinition,
    getAllRoleDefinitions,

    // Dogs page helpers
    addPet,
    updatePet,

    // Sitter profile helpers
    setSelectedSitterId,
    getSelectedSitter
  };
})();
