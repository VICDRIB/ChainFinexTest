import {
    currentUser,
    formatCurrency,
    navigate,
    toast
} from "../app.js";
import api from "../api.js";

console.log(currentUser);
export async function render(container) {

    const accountId = (
        100000000 + currentUser.id * 73129
    ).toString().slice(0, 9);

    container.innerHTML = `
<div class="page-inner">

    <div class="page-header">

        <div>

            <h1 class="page-title">
                My Profile
            </h1>

            <p class="page-subtitle">
                Manage your account.
            </p>

        </div>

    </div>

    <div class="card profile-header-card">

    <div
    class="profile-avatar-large"
    id="profileAvatarLarge"
    style="cursor:pointer;"
>
    ${
        currentUser.avatarUrl
        ? `<img
              src="${currentUser.avatarUrl}"
              class="profile-avatar-large-img">`
        : currentUser.name
            .split(" ")
            .map(n => n[0])
            .join("")
            .substring(0,2)
            .toUpperCase()
    }

    <input
        id="avatarInput"
        type="file"
        accept="image/*"
        style="display:none;">
</div>

    <div class="profile-info">

        <h2>${currentUser.name}</h2>

        <p>${currentUser.email}</p>

        <div class="profile-meta">
            Account ID #${accountId}
        </div>

    </div>

</div>

<div class="card profile-member-card">

    <div class="member-icon">
        🪪
    </div>

    <div class="member-info">

        <div class="member-label">
            Member Since
        </div>

        <div class="member-date">
            ${new Date(currentUser.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            })}
        </div>

    </div>

</div>

    <div class="card" style="margin-top:24px;">

    <div class="card-header">
        <div class="card-title">
            Personal Information
        </div>
    </div>

    <div class="card-body">

    <div class="profile-field">

        <div class="profile-field-icon">👤</div>

        <div class="profile-field-content">

            <label>Full Name</label>

            <input
                id="profileName"
                class="profile-modern-input"
                placeholder="Enter your full name"
                value="${currentUser.name || ""}">

        </div>

    </div>

    <div class="profile-field">

        <div class="profile-field-icon">✉️</div>

        <div class="profile-field-content">

            <label>Email Address</label>

            <input
                id="profileEmail"
                type="email"
                class="profile-modern-input"
                placeholder="Enter your email"
                value="${currentUser.email || ""}">

        </div>

    </div>

    <div class="profile-field">

        <div class="profile-field-icon">📱</div>

        <div class="profile-field-content">

            <label>Phone Number</label>

            <input
                id="profilePhone"
                class="profile-modern-input"
                placeholder="Enter phone number"
                value="${currentUser.phone || ""}">

        </div>

    </div>

    <div class="profile-field">

        <div class="profile-field-icon">🎂</div>

        <div class="profile-field-content">

            <label>Date of Birth</label>

            <input
                id="profileDob"
                type="date"
                class="profile-modern-input"
                value="${currentUser.date_of_birth || ""}">

        </div>

    </div>

    <div class="profile-field">

        <div class="profile-field-icon">🌍</div>

        <div class="profile-field-content">

            <label>Country</label>

            <input
                id="profileCountry"
                class="profile-modern-input"
                placeholder="Country"
                value="${currentUser.country || ""}">

        </div>

    </div>

    <div class="profile-field">

        <div class="profile-field-icon">📍</div>

        <div class="profile-field-content">

            <label>Address</label>

            <textarea
                id="profileAddress"
                class="profile-modern-input profile-modern-textarea"
                rows="3"
                placeholder="Enter your address">${currentUser.address || ""}</textarea>

        </div>

    </div>

    ${
        currentUser.role === "admin"
            ? `
            <div class="profile-field">

                <div class="profile-field-icon">🛡️</div>

                <div class="profile-field-content">

                    <label>Role</label>

                    <input
                        class="profile-modern-input"
                        value="${currentUser.role}"
                        readonly>

                </div>

            </div>
            `
            : ""
    }

    <button
        id="updateProfileBtn"
        class="btn btn-primary btn-w100"
        style="margin-top:24px;">
        Update Profile
    </button>

</div>

    </div>

    </div>

</div>

</div>

`;

const profileAvatar = document.getElementById("profileAvatarLarge");

if (profileAvatar) {

    profileAvatar.onclick = () => {

        document.getElementById("avatarInput")?.click();

    };

}

const avatarInput = document.getElementById("avatarInput");

if (avatarInput) {

    avatarInput.onchange = async (e) => {

        const file = e.target.files[0];

        if (!file) return;

        try {

            const result = await api.uploadAvatar(file);

            currentUser.avatarUrl = result.avatarUrl;

            toast("Profile picture updated!", "success");

            render(container);

        } catch (err) {

            toast(err.message, "error");

        }

    };

}

document
    .getElementById("updateProfileBtn")
    .onclick = async () => {

    try {

        const updated = await api.updateProfile({

            name: document.getElementById("profileName").value.trim(),

            email: document.getElementById("profileEmail").value.trim(),

            phone: document.getElementById("profilePhone").value.trim(),

            date_of_birth: document.getElementById("profileDob").value,

            country: document.getElementById("profileCountry").value.trim(),

            address: document.getElementById("profileAddress").value.trim()

        });

        Object.assign(currentUser, updated);

        toast("Profile updated successfully.", "success");

        render(container);

    }

    catch (err) {

        toast(err.message, "error");

    }

};

}