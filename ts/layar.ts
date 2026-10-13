// dibungkus fungsi biar type dan const di sini gak bentrok sama file .ts lain
// (file ts di proyek ini bukan module, jadi waktu dikompilasi semuanya satu scope global)
(() => {
  type Prioritas = "Normal" | "Lansia" | "Disabilitas" | "VIP";
  type StatusTiket = "menunggu" | "dipanggil" | "selesai" | "dilewati";

  interface Sesi {
    token: string;
    role: string;
    nama: string;
  }

  interface JenisAntrian {
    kode: string;
    nama: string;
    aktif: boolean;
  }

  interface Tiket {
    nomor: string;
    kode: string;
    prioritas: Prioritas;
    status: StatusTiket;
    dibuat: number;
  }

  // key dan bentuk datanya sama persis dengan index.ts
  const KUNCI_SESI = "sesi";
  const KUNCI_JENIS = "jenisAntrian";
  const KUNCI_TIKET = "tiketAntrian";

  // urutan sama dengan index.ts, makin kecil makin didahulukan
  const URUTAN_PRIORITAS: Prioritas[] = ["Disabilitas", "Lansia", "VIP", "Normal"];

  // soal minta polling 2-3 detik
  const JEDA_POLLING = 2500;

  // dipakai kalau dashboard belum pernah dibuka (sama dengan JENIS_AWAL di index.ts)
  const JENIS_AWAL: JenisAntrian[] = [
    { kode: "A", nama: "UMUM-1", aktif: true },
    { kode: "B", nama: "UMUM-2", aktif: true },
    { kode: "C", nama: "UMUM-3", aktif: true },
    { kode: "G", nama: "GIGI", aktif: true },
    { kode: "F", nama: "FARMASI", aktif: true },
    { kode: "P", nama: "PSIKOLOG", aktif: true },
  ];

  function bacaJson<T>(kunci: string, cadangan: T): T {
    const mentah = localStorage.getItem(kunci);
    if (mentah === null) return cadangan;
    try {
      return JSON.parse(mentah);
    } catch {
      return cadangan;
    }
  }

  function ambilSesi(): Sesi | null {
    const sesi = bacaJson<Partial<Sesi> | null>(KUNCI_SESI, null);
    if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string") return null;
    return { token: sesi.token, role: sesi.role, nama: sesi.nama ?? "-" };
  }

  // auth guard: halaman ini cuma buat yang sudah login (user, admin, moderator semuanya boleh)
  if (ambilSesi() === null) {
    location.replace("login.html");
    return;
  }

  function bacaJenis(): JenisAntrian[] {
    const jenis = bacaJson<unknown>(KUNCI_JENIS, JENIS_AWAL);
    return Array.isArray(jenis) ? jenis : [];
  }

  function bacaTiket(): Tiket[] {
    const tiket = bacaJson<unknown>(KUNCI_TIKET, []);
    return Array.isArray(tiket) ? tiket : [];
  }

  function ambil<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Elemen ${selector} tidak ketemu`);
    return el;
  }

  function buat<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    kelas = "",
    teks = ""
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks) el.textContent = teks;
    return el;
  }

  const wadahKartu = ambil<HTMLElement>(".panel-utama");
  const navMenu = ambil<HTMLElement>(".panel-nav");

  // pakai gaya .notif yang sudah ada di style.css
  const notif = buat("p", "notif");
  notif.setAttribute("role", "status");
  notif.setAttribute("aria-live", "polite");
  document.body.append(notif);

  let timerNotif: number | undefined;

  function tampilkanNotif(pesan: string): void {
    notif.textContent = pesan;
    notif.classList.add("muncul");
    clearTimeout(timerNotif);
    timerNotif = window.setTimeout(() => notif.classList.remove("muncul"), 4000);
  }

  // Exit = keluar akun, jadi sesinya dihapus dulu (sama seperti logout di dashboard)
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href="login.html"]')) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem(KUNCI_SESI);
      location.replace("login.html");
    });
  }

  // ---------- layar penuh ----------

  // tombolnya dicari di html dulu (#tombol-layar-penuh), kalau belum ada dibuat di menu atas
  function siapkanTombolPenuh(): HTMLButtonElement {
    const ada = document.querySelector<HTMLButtonElement>("#tombol-layar-penuh");
    if (ada) return ada;

    const baru = buat("button", "tombol");
    baru.id = "tombol-layar-penuh";
    baru.type = "button";
    navMenu.insertBefore(baru, navMenu.lastElementChild); // sebelum tombol Exit
    return baru;
  }

  const tombolPenuh = siapkanTombolPenuh();

  function aturLabelPenuh(): void {
    tombolPenuh.textContent = document.fullscreenElement ? "Keluar Layar Penuh" : "Layar Penuh";
  }

  tombolPenuh.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      tampilkanNotif("Browser tidak mengizinkan layar penuh.");
    }
  });

  // label ikut berubah juga kalau keluar lewat tombol Esc
  document.addEventListener("fullscreenchange", aturLabelPenuh);
  aturLabelPenuh();

  // ---------- kartu antrian ----------

  interface KartuRef {
    menunggu: HTMLElement;
    sebelumnya: HTMLElement;
    dipanggil: HTMLElement;
    berikutnya: HTMLElement;
    tombol: HTMLButtonElement;
  }

  const kartuAda = new Map<string, KartuRef>();
  let tandaJenis = "";

  // jenis yang tombol Notify Me-nya lagi aktif, dan nomor terakhir yang dipanggil per jenis
  const diikuti = new Set<string>();
  const nomorTerakhir = new Map<string, string>();

  function buatBlok(keterangan: string, kelas = "") {
    const blok = buat("div", `blok-info ${kelas}`.trim());
    const angka = buat("p", "angka");
    blok.append(angka, buat("p", "keterangan", keterangan));
    return { blok, angka };
  }

  // struktur dan class-nya sama dengan kartu di layar.html
  function buatKartu(jenis: JenisAntrian): HTMLElement {
    const kartu = buat("article", "kartu");

    const nama = buat("h2", "nama-antrian");
    nama.append(buat("b", "", jenis.nama), buat("i", "", `(${jenis.kode})`));
    const menunggu = buat("p", "keterangan");
    const blokNama = buat("div", "blok-info");
    blokNama.append(nama, menunggu);

    const sebelumnya = buatBlok("Sebelumnya", "rata-kanan");
    const atas = buat("div", "kartu-atas");
    atas.append(blokNama, sebelumnya.blok);

    const dipanggil = buatBlok("Sedang Dipanggil");
    const berikutnya = buatBlok("Berikutnya");
    const bawah = buat("div", "kartu-bawah");
    bawah.append(dipanggil.blok, berikutnya.blok);

    const tombol = buat("button", "tombol tombol-kuning");
    tombol.type = "button";
    tombol.dataset.kode = jenis.kode;

    kartu.append(atas, bawah, tombol);
    kartuAda.set(jenis.kode, {
      menunggu,
      sebelumnya: sebelumnya.angka,
      dipanggil: dipanggil.angka,
      berikutnya: berikutnya.angka,
      tombol,
    });
    return kartu;
  }

  function angkaNomor(nomor: string): number {
    return Number(nomor.split("-")[1]) || 0;
  }

  // sama dengan urutan di index.ts: prioritas dulu, kalau sama yang lebih dulu dibuat
  function urutanTiket(a: Tiket, b: Tiket): number {
    const selisih = URUTAN_PRIORITAS.indexOf(a.prioritas) - URUTAN_PRIORITAS.indexOf(b.prioritas);
    return selisih !== 0 ? selisih : a.dibuat - b.dibuat;
  }

  function umumkan(nomor: string, loket: string): void {
    tampilkanNotif(`Nomor ${nomor} dipanggil, silakan menuju ${loket}.`);
    if (!("speechSynthesis" in window)) return;

    const [huruf, angka] = nomor.split("-");
    const suara = new SpeechSynthesisUtterance(
      `Nomor antrian ${huruf} ${Number(angka)}, silakan menuju ${loket}`
    );
    suara.lang = "id-ID";
    speechSynthesis.cancel();
    speechSynthesis.speak(suara);
  }

  function render(): void {
    const jenisAktif = bacaJenis().filter((j) => j.aktif);
    const tiket = bacaTiket();

    // kartu cuma dibuat ulang kalau daftar jenis aktifnya berubah, selain itu teksnya saja yang diganti
    const tanda = jenisAktif.map((j) => `${j.kode}:${j.nama}`).join("|");
    if (tanda !== tandaJenis) {
      tandaJenis = tanda;
      kartuAda.clear();
      wadahKartu.replaceChildren(...jenisAktif.map((j) => buatKartu(j)));
      if (jenisAktif.length === 0) {
        wadahKartu.append(buat("p", "kosong", "Belum ada jenis antrian yang aktif."));
      }
    }

    for (const jenis of jenisAktif) {
      const ref = kartuAda.get(jenis.kode);
      if (!ref) continue;

      const milik = tiket.filter((t) => t.kode === jenis.kode);
      const menunggu = milik.filter((t) => t.status === "menunggu").sort(urutanTiket);
      const dipanggil = milik.find((t) => t.status === "dipanggil");
      // tiket belum punya waktu dipanggil, jadi "sebelumnya" diambil dari nomor selesai terbesar
      const selesai: Tiket | undefined = milik
        .filter((t) => t.status === "selesai")
        .sort((a, b) => angkaNomor(b.nomor) - angkaNomor(a.nomor))[0];
      const berikutnya: Tiket | undefined = menunggu[0];

      ref.menunggu.textContent = `${menunggu.length} Tiket Menunggu`;
      ref.sebelumnya.textContent = selesai ? selesai.nomor : `${jenis.kode}-000`;
      ref.dipanggil.textContent = dipanggil ? dipanggil.nomor : "-";
      ref.berikutnya.textContent = berikutnya ? berikutnya.nomor : "-";
      ref.tombol.textContent = diikuti.has(jenis.kode) ? "Notifikasi Aktif" : "Notify Me";

      // pertama kali dimuat cuma catat nomor, jangan diumumkan
      const nomorSekarang = dipanggil ? dipanggil.nomor : "";
      const nomorLama = nomorTerakhir.get(jenis.kode);
      nomorTerakhir.set(jenis.kode, nomorSekarang);
      if (
        diikuti.has(jenis.kode) &&
        nomorLama !== undefined &&
        nomorSekarang !== "" &&
        nomorSekarang !== nomorLama
      ) {
        umumkan(nomorSekarang, jenis.nama);
      }
    }
  }

  // Notify Me: nyalakan atau matikan pengumuman suara untuk satu jenis antrian
  wadahKartu.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const kode = target.dataset.kode;
    const jenis = bacaJenis().find((j) => j.kode === kode);
    if (!kode || !jenis) return;

    if (diikuti.has(kode)) {
      diikuti.delete(kode);
      tampilkanNotif(`Notifikasi ${jenis.nama} dimatikan.`);
    } else {
      diikuti.add(kode);
      tampilkanNotif(`Notifikasi ${jenis.nama} aktif, kamu diberi tahu tiap ada nomor yang dipanggil.`);
    }
    render();
  });

  // kalau sesi dihapus (logout di tab lain) langsung balik ke login, kalau tidak data diperbarui
  function segarkan(): void {
    if (ambilSesi() === null) {
      location.replace("login.html");
      return;
    }
    render();
  }

  window.addEventListener("storage", segarkan);
  window.setInterval(segarkan, JEDA_POLLING);
  render();
})();