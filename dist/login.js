"use strict";
(() => {
    const API_LOGIN = "https://dummyjson.com/auth/login";
    const API_USERS = "https://dummyjson.com/users";
    const KUNCI_SESI = "sesi";
    function ambilElemen(selector) {
        const elemen = document.querySelector(selector);
        if (!elemen) {
            throw new Error(`Elemen ${selector} tidak ditemukan`);
        }
        return elemen;
    }
    function pesanDariRespons(data) {
        return typeof data.message === "string" && data.message.trim() !== ""
            ? data.message
            : "Username atau password salah.";
    }
    function bacaRespons(data) {
        if (typeof data !== "object" || data === null) {
            throw new Error("Respons server tidak valid.");
        }
        return data;
    }
    function ambilString(value, nama) {
        if (typeof value !== "string" || value.trim() === "") {
            throw new Error(`Respons server tidak memiliki ${nama} yang valid.`);
        }
        return value;
    }
    function tampilkanError(elemen, pesan) {
        elemen.textContent = pesan;
        elemen.hidden = false;
    }
    function sembunyikanError(elemen) {
        elemen.textContent = "";
        elemen.hidden = true;
    }
    async function masuk(username, password) {
        const respons = await fetch(API_LOGIN, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username,
                password,
                expiresInMins: 30,
            }),
        });
        let data;
        try {
            data = bacaRespons(await respons.json());
        }
        catch (error) {
            if (error instanceof Error && error.message === "Respons server tidak valid.") {
                throw error;
            }
            throw new Error("Respons server tidak dapat dibaca.");
        }
        if (!respons.ok) {
            throw new Error(pesanDariRespons(data));
        }
        const token = ambilString(data.accessToken ?? data.token, "token");
        const id = data.id;
        if (typeof id !== "number") {
            throw new Error("Respons server tidak memiliki identitas pengguna yang valid.");
        }
        const responsPengguna = await fetch(`${API_USERS}/${id}`);
        let pengguna;
        try {
            pengguna = bacaRespons(await responsPengguna.json());
        }
        catch (error) {
            if (error instanceof Error && error.message === "Respons server tidak valid.") {
                throw error;
            }
            throw new Error("Respons data pengguna tidak dapat dibaca.");
        }
        if (!responsPengguna.ok) {
            throw new Error(pesanDariRespons(pengguna));
        }
        const role = ambilString(pengguna.role, "role").toLowerCase();
        const nama = ambilString(pengguna.firstName ?? data.firstName ?? data.username, "nama pengguna");
        localStorage.setItem(KUNCI_SESI, JSON.stringify({
            token,
            role,
            nama,
            firstName: nama,
        }));
        if (role === "admin" || role === "moderator") {
            location.replace("index.html");
            return;
        }
        if (role === "user") {
            location.replace("ambil-antrian.html");
            return;
        }
        localStorage.removeItem(KUNCI_SESI);
        throw new Error("Role akun tidak dikenali.");
    }
    const formLogin = ambilElemen(".login-form");
    const inputUsername = ambilElemen("#username");
    const inputPassword = ambilElemen("#password");
    const tombolLogin = ambilElemen('button[type="submit"]');
    const pesanError = document.createElement("p");
    pesanError.className = "gagal login-error";
    pesanError.setAttribute("role", "alert");
    pesanError.hidden = true;
    formLogin.prepend(pesanError);
    formLogin.addEventListener("submit", async (event) => {
        event.preventDefault();
        sembunyikanError(pesanError);
        const username = inputUsername.value.trim();
        const password = inputPassword.value;
        if (username === "" || password === "") {
            tampilkanError(pesanError, "Username dan password wajib diisi.");
            return;
        }
        tombolLogin.disabled = true;
        inputUsername.disabled = true;
        inputPassword.disabled = true;
        tombolLogin.textContent = "Memverifikasi...";
        formLogin.setAttribute("aria-busy", "true");
        try {
            await masuk(username, password);
        }
        catch (error) {
            const pesan = error instanceof TypeError
                ? "Koneksi gagal. Periksa koneksi internet lalu coba lagi."
                : error instanceof Error
                    ? error.message
                    : "Login gagal. Silakan coba lagi.";
            tampilkanError(pesanError, pesan);
        }
        finally {
            tombolLogin.disabled = false;
            inputUsername.disabled = false;
            inputPassword.disabled = false;
            tombolLogin.textContent = "Login";
            formLogin.removeAttribute("aria-busy");
        }
    });
})();
