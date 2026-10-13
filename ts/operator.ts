(() => {
  type Prioritas = "Normal" | "Lansia" | "Disabilitas" | "VIP";
  type StatusTiket = "menunggu" | "dipanggil" | "selesai" | "dilewati";

  interface Sesi {
    token: string;
    role: string;
    nama: string;
  }

  interface Tiket {
    nomor: string;
    kode: string;
    prioritas: Prioritas;
    status: StatusTiket;
    dibuat: number;
  }

  const KUNCI_SESI = "sesi";
  const KUNCI_TIKET = "tiketAntrian";
  const URUTAN_PRIORITAS: Prioritas[] = ["Disabilitas", "Lansia", "VIP", "Normal"];

  function bacaJson<T>(kunci: string, cadangan: T): T {
    const nilai = localStorage.getItem(kunci);
    if (nilai === null) return cadangan;
    try {
      return JSON.parse(nilai);
    } catch {
      return cadangan;
    }
  }

  function ambilSesi(): Sesi | null {
    const sesi = bacaJson<Partial<Sesi> | null>(KUNCI_SESI, null);
    if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string") return null;
    return { token: sesi.token, role: sesi.role.toLowerCase(), nama: sesi.nama ?? "-" };
  }

  const sesi = ambilSesi();
  if (!sesi) {
    location.replace("login.html");
    return;
  }

  if (sesi.role !== "admin" && sesi.role !== "moderator") {
    location.replace("ambil-antrian.html");
    return;
  }

  function bacaTiket(): Tiket[] {
    const tiket = bacaJson<unknown>(KUNCI_TIKET, []);
    return Array.isArray(tiket) ? tiket : [];
  }

  function simpanTiket(tiket: Tiket[]): void {
    localStorage.setItem(KUNCI_TIKET, JSON.stringify(tiket));
  }

  function tiketBerikutnya(tiket: Tiket[], kode: string): Tiket | undefined {
    return tiket
      .filter((item) => item.kode === kode && item.status === "menunggu")
      .sort((a, b) => {
        const prioritasA = URUTAN_PRIORITAS.indexOf(a.prioritas);
        const prioritasB = URUTAN_PRIORITAS.indexOf(b.prioritas);
        return prioritasA - prioritasB || a.dibuat - b.dibuat;
      })[0];
  }

  function render(): void {
    const semuaTiket = bacaTiket();
    for (const kartu of document.querySelectorAll<HTMLElement>(".kartu")) {
      const kode = kartu.querySelector<HTMLButtonElement>("[data-kode]")?.dataset.kode;
      if (!kode) continue;

      const menunggu = semuaTiket.filter(
        (tiket) => tiket.kode === kode && tiket.status === "menunggu"
      );
      const aktif = semuaTiket.find(
        (tiket) => tiket.kode === kode && tiket.status === "dipanggil"
      );
      const berikutnya = tiketBerikutnya(semuaTiket, kode);
      const keterangan = kartu.querySelector<HTMLElement>(".kartu-atas .keterangan");
      const angka = kartu.querySelectorAll<HTMLElement>(".kartu-tengah .angka");
      const tombolSelesai = kartu.querySelector<HTMLButtonElement>(".tombol-selesai-pojok");
      const kosong = kartu.querySelector<HTMLElement>(".kartu-kosong");

      if (keterangan) keterangan.textContent = `${menunggu.length} Menunggu`;
      if (angka[0]) angka[0].textContent = aktif?.nomor ?? "-";
      if (angka[1]) angka[1].textContent = berikutnya?.nomor ?? "-";
      if (tombolSelesai) tombolSelesai.disabled = !aktif;
      if (kosong) kosong.hidden = menunggu.length > 0;
    }
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href="login.html"]')) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem(KUNCI_SESI);
      location.replace("login.html");
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-kode]").forEach((tombol) => {
    tombol.addEventListener("click", () => {
      const kode = tombol.dataset.kode;
      if (!kode) return;

      const semuaTiket = bacaTiket();
      const aktif = semuaTiket.find(
        (tiket) => tiket.kode === kode && tiket.status === "dipanggil"
      );

      if (tombol.classList.contains("tombol-selesai-pojok")) {
        if (!aktif) return;
        aktif.status = "selesai";
      } else {
        const berikutnya = tiketBerikutnya(semuaTiket, kode);
        if (!berikutnya) return;
        berikutnya.status = "dipanggil";
      }

      simpanTiket(semuaTiket);
      render();
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === KUNCI_SESI && !ambilSesi()) {
      location.replace("login.html");
    } else if (event.key === KUNCI_TIKET) {
      render();
    }
  });

  render();
})();