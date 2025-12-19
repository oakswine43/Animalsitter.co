// js/pages/dogs.js
// Dogs page: clients can view and edit their dogs

(function () {
  let editingPetId = null;

  function renderDogsCard(root, state, user) {
    if (!root) return;

    const allPets = state.getPets ? state.getPets() : [];
    const myPets = allPets.filter((p) => p.ownerId === user.id);

    root.innerHTML = `
      <div class="section-card">
        <div class="card-header">
          <div>
            <div class="card-title">Your Dogs</div>
            <div class="card-subtitle">
              View, add, and edit your dogs' profiles so sitters know how to care for them.
            </div>
          </div>
          <button class="btn-primary" id="addDogBtn">+ Add Dog</button>
        </div>

        <div id="dogsLayout" class="dashboard-layout" style="margin-top:12px;">
          <!-- Left: list of dogs -->
          <div class="dashboard-card">
            <h3 style="margin-top:0;">Saved Dogs</h3>
            ${
              myPets.length === 0
                ? `<p class="text-muted" style="font-size:13px;">
                     You haven’t added any dogs yet. Click <strong>+ Add Dog</strong> to create a profile.
                   </p>`
                : `
                  <div class="simple-list">
                    ${myPets
                      .map(
                        (p) => `
                          <div class="simple-list-item" data-pet-id="${p.id}">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                              <div>
                                <strong>${p.name || "Unnamed dog"}</strong>
                                <div class="text-muted" style="font-size:12px;">
                                  ${p.breed || "Unknown breed"}${p.color ? " • " + p.color : ""}
                                </div>
                                <div class="text-muted" style="font-size:12px; margin-top:2px;">
                                  ${
                                    p.ageYears || p.ageMonths
                                      ? `Age: ${
                                          p.ageYears ? p.ageYears + " yr" : ""
                                        } ${
                                          p.ageMonths ? p.ageMonths + " mo" : ""
                                        }`
                                      : "Age not set"
                                  }
                                  ${
                                    p.weight
                                      ? ` • Weight: ${p.weight} lbs`
                                      : ""
                                  }
                                </div>
                                ${
                                  p.aggression
                                    ? `<div class="text-muted" style="font-size:12px; margin-top:2px;">
                                         Temperament: ${p.aggression}
                                       </div>`
                                    : ""
                                }
                                ${
                                  p.notes
                                    ? `<div style="font-size:12px; margin-top:4px;">
                                         <em>${p.notes}</em>
                                       </div>`
                                    : ""
                                }
                              </div>

                              <div>
                                <button
                                  class="btn-small"
                                  data-dog-action="edit"
                                  data-pet-id="${p.id}"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                `
            }
          </div>

          <!-- Right: form to add/edit -->
          <div class="dashboard-card">
            <h3 style="margin-top:0;" id="dogFormTitle">
              Add a Dog
            </h3>
            <p class="text-muted" style="font-size:12px; margin-bottom:8px;">
              Fill out as much as you like. Sitters use this to follow routines, watch for triggers, and keep your dog safe.
            </p>

            <form id="dogForm" class="form-grid" autocomplete="off">
              <input type="hidden" id="dogIdField" />

              <div class="field-group">
                <label for="dogName">Name</label>
                <input
                  id="dogName"
                  type="text"
                  class="input"
                  placeholder="Bella"
                  required
                />
              </div>

              <div class="field-group">
                <label for="dogBreed">Breed</label>
                <input
                  id="dogBreed"
                  type="text"
                  class="input"
                  placeholder="Lab / Mixed / Unknown"
                />
              </div>

              <div class="field-group">
                <label>Age</label>
                <div style="display:flex; gap:6px;">
                  <input
                    id="dogAgeYears"
                    type="number"
                    class="input"
                    min="0"
                    placeholder="Years"
                    style="max-width:90px;"
                  />
                  <input
                    id="dogAgeMonths"
                    type="number"
                    class="input"
                    min="0"
                    max="11"
                    placeholder="Months"
                    style="max-width:90px;"
                  />
                </div>
              </div>

              <div class="field-group">
                <label for="dogWeight">Weight (lbs)</label>
                <input
                  id="dogWeight"
                  type="number"
                  class="input"
                  min="0"
                  step="0.1"
                  placeholder="e.g., 45"
                />
              </div>

              <div class="field-group">
                <label for="dogColor">Color / Markings</label>
                <input
                  id="dogColor"
                  type="text"
                  class="input"
                  placeholder="Black with white chest"
                />
              </div>

              <div class="field-group">
                <label for="dogAggression">Temperament / Aggression</label>
                <select id="dogAggression" class="input">
                  <option value="">Select...</option>
                  <option value="Very calm">Very calm</option>
                  <option value="Friendly but energetic">Friendly but energetic</option>
                  <option value="Anxious / shy">Anxious / shy</option>
                  <option value="Reactive to dogs">Reactive to other dogs</option>
                  <option value="Reactive to people">Reactive to people</option>
                  <option value="Resource guarding (food/toys)">Resource guarding</option>
                </select>
              </div>

              <div class="field-group form-grid-full">
                <label for="dogNotes">Special Notes / Instructions</label>
                <textarea
                  id="dogNotes"
                  rows="3"
                  class="input"
                  placeholder="Feeding schedule, meds, triggers, favorite games, etc."
                ></textarea>
              </div>

              <div class="form-grid-full" style="margin-top:8px; display:flex; gap:8px;">
                <button type="submit" class="btn-primary" id="saveDogBtn">
                  Save Dog
                </button>
                <button type="button" class="btn-small" id="resetDogFormBtn">
                  Clear Form
                </button>
              </div>

              <p
                id="dogFormMessage"
                class="text-muted"
                style="font-size:12px; margin-top:6px;"
              ></p>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function loadPetIntoForm(pet) {
    const title = document.getElementById("dogFormTitle");
    const idField = document.getElementById("dogIdField");
    const nameInput = document.getElementById("dogName");
    const breedInput = document.getElementById("dogBreed");
    const ageYInput = document.getElementById("dogAgeYears");
    const ageMInput = document.getElementById("dogAgeMonths");
    const weightInput = document.getElementById("dogWeight");
    const colorInput = document.getElementById("dogColor");
    const aggrSelect = document.getElementById("dogAggression");
    const notesInput = document.getElementById("dogNotes");

    editingPetId = pet.id;

    if (title) title.textContent = `Edit Dog: ${pet.name || ""}`;
    if (idField) idField.value = pet.id || "";
    if (nameInput) nameInput.value = pet.name || "";
    if (breedInput) breedInput.value = pet.breed || "";
    if (ageYInput) ageYInput.value = pet.ageYears || "";
    if (ageMInput) ageMInput.value = pet.ageMonths || "";
    if (weightInput) weightInput.value = pet.weight || "";
    if (colorInput) colorInput.value = pet.color || "";
    if (aggrSelect) aggrSelect.value = pet.aggression || "";
    if (notesInput) notesInput.value = pet.notes || "";
  }

  function resetDogForm() {
    editingPetId = null;
    const title = document.getElementById("dogFormTitle");
    const idField = document.getElementById("dogIdField");
    const form = document.getElementById("dogForm");
    const msg = document.getElementById("dogFormMessage");

    if (title) title.textContent = "Add a Dog";
    if (idField) idField.value = "";
    if (form) form.reset();
    if (msg) {
      msg.textContent = "";
    }
  }

  // Public init called from app.js when Dogs page is activated
  window.initDogsPage = function () {
    const dogsSection = document.getElementById("dogsPage");
    if (!dogsSection) return;

    const state = window.PetCareState;
    if (!state) {
      dogsSection.innerHTML =
        "<p class='text-muted'>State not ready. Please make sure state.js is loaded.</p>";
      return;
    }

    const user = state.getCurrentUser && state.getCurrentUser();
    if (!user || user.role !== "client") {
      // Only clients manage dogs for now
      const card = dogsSection.querySelector(".section-card") || dogsSection;
      card.innerHTML = `
        <div class="section-card">
          <h2>Your dogs</h2>
          <p class="text-muted" style="font-size:13px;">
            Switch to the <strong>Client</strong> role in the header to add and edit dog profiles.
          </p>
        </div>
      `;
      return;
    }

    // Use the existing section-card as our root if present, otherwise the page itself.
    const root =
      dogsSection.querySelector(".section-card") || dogsSection;

    renderDogsCard(root, state, user);

    // Wire events (submit, edit, add, reset) using event delegation
    const dogsLayout = document.getElementById("dogsLayout");
    const dogForm = document.getElementById("dogForm");
    const addDogBtn = document.getElementById("addDogBtn");
    const resetBtn = document.getElementById("resetDogFormBtn");

    if (dogForm) {
      dogForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!state.addPet || !state.updatePet) {
          alert("Pet helpers not available on state.");
          return;
        }

        const idField = document.getElementById("dogIdField");
        const nameInput = document.getElementById("dogName");
        const breedInput = document.getElementById("dogBreed");
        const ageYInput = document.getElementById("dogAgeYears");
        const ageMInput = document.getElementById("dogAgeMonths");
        const weightInput = document.getElementById("dogWeight");
        const colorInput = document.getElementById("dogColor");
        const aggrSelect = document.getElementById("dogAggression");
        const notesInput = document.getElementById("dogNotes");
        const msg = document.getElementById("dogFormMessage");

        const payload = {
          ownerId: user.id,
          name: nameInput ? nameInput.value.trim() : "",
          breed: breedInput ? breedInput.value.trim() : "",
          ageYears: ageYInput && ageYInput.value ? parseInt(ageYInput.value, 10) : "",
          ageMonths: ageMInput && ageMInput.value ? parseInt(ageMInput.value, 10) : "",
          weight: weightInput && weightInput.value ? parseFloat(weightInput.value) : "",
          color: colorInput ? colorInput.value.trim() : "",
          aggression: aggrSelect ? aggrSelect.value : "",
          notes: notesInput ? notesInput.value.trim() : ""
        };

        const existingId = idField ? idField.value : "";

        let savedPet = null;
        if (existingId) {
          // update
          savedPet = state.updatePet(existingId, payload);
          if (msg) msg.textContent = "Dog updated.";
        } else {
          // add new
          savedPet = state.addPet(payload);
          if (msg) msg.textContent = "Dog added.";
        }

        // Re-render list so changes appear
        renderDogsCard(root, state, user);
        // re-run init to rebind events
        window.initDogsPage();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetDogForm();
      });
    }

    if (addDogBtn) {
      addDogBtn.addEventListener("click", function () {
        resetDogForm();
      });
    }

    if (dogsLayout) {
      dogsLayout.addEventListener("click", function (e) {
        const editBtn = e.target.closest("[data-dog-action='edit']");
        if (!editBtn) return;

        const petId = editBtn.getAttribute("data-pet-id");
        if (!petId) return;

        const allPets = state.getPets ? state.getPets() : [];
        const pet = allPets.find((p) => p.id === petId);
        if (!pet) return;

        loadPetIntoForm(pet);
      });
    }
  };
})();
