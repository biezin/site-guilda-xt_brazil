const WHATSAPP_NUMBER = "5511934336326";
let ownerAuthenticated = false;

const state = {
  filter: "all",
  query: "",
  cart: [],
  activeProduct: null,
  device: null
};

const deviceModels = {
  "Apple iPhone": ["iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max", "iPhone 14", "iPhone 14 Pro", "iPhone 14 Pro Max", "iPhone 15", "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 16", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 17", "iPhone 17 Pro", "iPhone 17 Pro Max"],
  "Samsung": ["Galaxy A05 / A05s", "Galaxy A14 / A15 / A16", "Galaxy A24 / A25 / A26", "Galaxy A34 / A35 / A36", "Galaxy A54 / A55 / A56", "Galaxy S21 / S21 FE", "Galaxy S22 / S22+ / Ultra", "Galaxy S23 / S23+ / Ultra / FE", "Galaxy S24 / S24+ / Ultra / FE", "Galaxy S25 / S25+ / Ultra", "Galaxy Z Flip / Fold"],
  "Motorola": ["Moto E13 / E14", "Moto G14 / G15", "Moto G34 / G35", "Moto G54 / G55", "Moto G84 / G85", "Edge 30 / 40", "Edge 50 / 60"],
  "Xiaomi / Redmi / POCO": ["Redmi 12 / 13 / 14C", "Redmi Note 12 / 13 / 14", "Redmi Note 12 Pro / 13 Pro / 14 Pro", "POCO C65 / C75", "POCO M6 / M7", "POCO X5 / X6 / X7", "POCO F5 / F6 / F7", "Xiaomi 13 / 14 / 15"],
  "Outra marca": ["Outro modelo (informe no atendimento)"]
};

const categoryNames = {
  sensi: "SENSIBILIDADE",
  codiguin: "CODIGUIN",
  prime: "PRIME",
  conta: "CONTA",
  kit: "KIT"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const productGrid = $("#productGrid");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const cartCount = $("#cartCount");
const cartDrawer = $("#cartDrawer");
const cartBackdrop = $("#cartBackdrop");
const cartItems = $("#cartItems");
const cartEmpty = $("#cartEmpty");
const cartFooter = $("#cartFooter");
const cartTotal = $("#cartTotal");
const toast = $("#toast");

function money(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();

  return PRODUCTS.filter((product) => {
    const matchCategory =
      state.filter === "all" ||
      product.category === state.filter;

    const matchQuery =
      !query ||
      `${product.name} ${product.description} ${categoryNames[product.category]}`
        .toLowerCase()
        .includes(query);

    return matchCategory && matchQuery;
  });
}

function renderProducts() {
  const products = filteredProducts();

  productGrid.innerHTML = "";

  emptyState.hidden = products.length !== 0;

  products.forEach((product) => {
    const soldOut = product.stock <= 0;

    const card = document.createElement("article");

    card.className = "product-card reveal visible";

    card.innerHTML = `
      <div class="product-image-wrap">

        <span class="product-badge">
          ${escapeHtml(product.badge)}
        </span>

        <span
          class="product-stock"
          style="${
            soldOut
              ? "color:#ff7b84;background:rgba(255,65,65,.08);border-color:rgba(255,65,65,.14)"
              : ""
          }"
        >
          ${
            soldOut
              ? "ESGOTADO"
              : `${product.stock} DISP.`
          }
        </span>

        <img
          src="${escapeHtml(product.image)}"
          alt="${escapeHtml(product.name)}"
          loading="lazy"
        />

      </div>

      <div class="product-content">

        <div class="product-category">
          ${escapeHtml(categoryNames[product.category])}
        </div>

        <h3>
          ${escapeHtml(product.name)}
        </h3>

        <p>
          ${escapeHtml(product.description)}
        </p>

        <div class="product-bottom">

          <div class="price">
            ${product.priceLabel || money(product.price)}
          </div>

          <div class="product-actions">

            <button
              class="icon-btn product-details"
              data-id="${product.id}"
              aria-label="Ver detalhes"
            >
              👁️
            </button>

            <button
              class="btn btn-small btn-primary add-to-cart"
              data-id="${product.id}"
              ${soldOut ? "disabled" : ""}
            >
              ${soldOut ? "Esgotado" : product.contactOnly ? "Consultar" : "Comprar"}
            </button>

          </div>

        </div>

      </div>
    `;

    productGrid.appendChild(card);
  });
}

function showToast(message) {
  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

function addToCart(id) {
  const product = PRODUCTS.find(
    (item) => String(item.id) === String(id)
  );

  if (!product || product.stock <= 0) {
    return;
  }

  const existing = state.cart.find((item) =>
    item.id === id && JSON.stringify(item.device || null) === JSON.stringify(state.device || null)
  );

  if (existing) {
    if (existing.qty >= product.stock) {
      showToast(
        "Você atingiu o estoque disponível desse produto."
      );

      return;
    }

    existing.qty += 1;

  } else {
    state.cart.push({ id, qty: 1, device: state.device });
  }

  updateCart();

  showToast(
    `${product.name} adicionado ao carrinho.`
  );
}

function removeFromCart(id) {
  state.cart = state.cart.filter(
    (item) => item.id !== id
  );

  updateCart();
}

function cartData() {
  return state.cart.map((item) => {
    const product = PRODUCTS.find(
      (product) => String(product.id) === String(item.id)
    );

    return {
      ...product,
      qty: item.qty,
      device: item.device
    };
  });
}

function updateCart() {
  const data = cartData();

  const totalQty = data.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  const totalValue = data.reduce(
    (sum, item) =>
      sum + item.price * item.qty,
    0
  );

  cartCount.textContent = totalQty;

  cartItems.innerHTML = "";

  cartTotal.textContent = money(totalValue);

  const isEmpty = data.length === 0;

  cartEmpty.style.display = isEmpty
    ? "block"
    : "none";

  cartFooter.style.display = isEmpty
    ? "none"
    : "block";

  data.forEach((item) => {
    const row = document.createElement("div");

    row.className = "cart-item";

    row.innerHTML = `
      <img
        src="${escapeHtml(item.image)}"
        alt="${escapeHtml(item.name)}"
      />

      <div>

        <h4>
          ${escapeHtml(item.name)}
        </h4>

        <small>
          Quantidade: ${item.qty}${item.device ? `<br>Aparelho: ${escapeHtml(item.device.brand)} — ${escapeHtml(item.device.model)}` : ""}
        </small>

        <button
          class="remove-cart-item"
          data-id="${item.id}"
        >
          Remover
        </button>

      </div>

      <div class="cart-item-price">

        <strong>
          ${money(item.price * item.qty)}
        </strong>

      </div>
    `;

    cartItems.appendChild(row);
  });
}

function openCart() {
  cartDrawer.classList.add("open");

  cartBackdrop.classList.add("open");

  cartDrawer.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add("no-scroll");
}

function closeCart() {
  cartDrawer.classList.remove("open");

  cartBackdrop.classList.remove("open");

  cartDrawer.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove("no-scroll");
}

function checkout() {
  const data = cartData();

  if (!data.length) {
    showToast(
      "Adicione pelo menos um produto ao carrinho."
    );

    return;
  }

  const lines = data.map(
    (item) =>
      `• ${item.name} x${item.qty}${item.device ? ` (${item.device.brand} — ${item.device.model})` : ""} — ${money(
        item.price * item.qty
      )}`
  );

  const total = data.reduce(
    (sum, item) =>
      sum + item.price * item.qty,
    0
  );

  const message = [
    "Olá! Vim pelo site da XT Brazil 🔥",
    "Quero fazer este pedido:",
    "",
    ...lines,
    "",
    `Total: ${money(total)}`,
    "",
    "Gostaria de saber as formas de pagamento e entrega."
  ].join("\n");

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function openProduct(id) {
  const product = PRODUCTS.find(
    (item) => String(item.id) === String(id)
  );

  if (!product) {
    return;
  }

  state.activeProduct = product;
  state.device = null;

  $("#dialogImage").src = product.image;

  $("#dialogImage").alt = product.name;

  $("#dialogBadge").textContent =
    product.badge;

  $("#dialogName").textContent =
    product.name;

  $("#dialogDescription").textContent =
    product.description;

  $("#dialogStock").textContent =
    product.stock > 0
      ? `${product.stock} disponível(is)`
      : "Esgotado";

  $("#dialogPrice").textContent =
    product.priceLabel || money(product.price);

  $("#deviceFields").hidden = product.category !== "sensi";
  $("#deviceBrand").value = "";
  $("#deviceModel").innerHTML = '<option value="">Selecione primeiro a marca</option>';
  $("#deviceModel").disabled = true;

  $("#dialogAdd").disabled =
    product.stock <= 0;

  $("#dialogAdd").textContent =
    product.stock > 0
      ? product.contactOnly ? "Consultar no WhatsApp" : "Adicionar ao carrinho"
      : "Esgotado";

  $("#productDialog").showModal();
}

function setupMenu() {
  const menu = $("#mobileMenu");
  const backdrop = $("#menuBackdrop");
  const button = $("#menuToggle");
  const close = $("#menuClose");

  function toggle(open) {
    menu.classList.toggle(
      "open",
      open
    );

    backdrop.classList.toggle(
      "open",
      open
    );

    button.setAttribute(
      "aria-expanded",
      String(open)
    );

    menu.setAttribute(
      "aria-hidden",
      String(!open)
    );

    document.body.classList.toggle(
      "no-scroll",
      open
    );
  }

  button.addEventListener(
    "click",
    () => toggle(true)
  );

  close.addEventListener(
    "click",
    () => toggle(false)
  );

  backdrop.addEventListener(
    "click",
    () => toggle(false)
  );

  $$("[data-close-menu]").forEach(
    (link) => {
      link.addEventListener(
        "click",
        () => toggle(false)
      );
    }
  );
}

function setupStore() {
  $$(".category-chip").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          state.filter =
            button.dataset.filter;

          $$(".category-chip").forEach(
            (item) => {
              item.classList.toggle(
                "active",
                item === button
              );
            }
          );

          renderProducts();
        }
      );

    }
  );

  searchInput.addEventListener(
    "input",
    (event) => {

      state.query =
        event.target.value;

      renderProducts();
    }
  );

  productGrid.addEventListener(
    "click",
    (event) => {

      const detailsButton =
        event.target.closest(
          ".product-details"
        );

      const addButton =
        event.target.closest(
          ".add-to-cart"
        );

      if (detailsButton) {
        openProduct(detailsButton.dataset.id);
      }

      if (addButton) {
        const id = addButton.dataset.id;
        const product = PRODUCTS.find((item) => String(item.id) === String(id));
        if (product?.contactOnly) contactAboutProduct(product);
        else if (product?.category === "sensi") openProduct(id);
        else addToCart(id);
      }

    }
  );

  cartItems.addEventListener(
    "click",
    (event) => {

      const removeButton =
        event.target.closest(
          ".remove-cart-item"
        );

      if (removeButton) {
        removeFromCart(
          Number(
            removeButton.dataset.id
          )
        );
      }

    }
  );
}

function setupCart() {
  $("#cartOpen").addEventListener(
    "click",
    openCart
  );

  $("#cartClose").addEventListener(
    "click",
    closeCart
  );

  cartBackdrop.addEventListener(
    "click",
    closeCart
  );

  $("#checkoutBtn").addEventListener(
    "click",
    checkout
  );

  $("#goToStore").addEventListener(
    "click",
    closeCart
  );
}

function setupDialog() {
  const dialog =
    $("#productDialog");

  $("#dialogClose").addEventListener(
    "click",
    () => dialog.close()
  );

  $("#dialogAdd").addEventListener(
    "click",
    () => {

      if (state.activeProduct) {
        if (state.activeProduct.contactOnly) {
          contactAboutProduct(state.activeProduct);
          $("#productDialog").close();
          return;
        }
        if (state.activeProduct.category === "sensi") {
          const brand = $("#deviceBrand").value;
          const model = $("#deviceModel").value;
          if (!brand || !model) {
            showToast("Selecione a marca e o modelo do aparelho.");
            return;
          }
          state.device = { brand, model };
        }
        addToCart(
          state.activeProduct.id
        );
      }

      dialog.close();

      openCart();
    }
  );

  dialog.addEventListener(
    "click",
    (event) => {

      if (event.target === dialog) {
        dialog.close();
      }

    }
  );
}

function contactAboutProduct(product) {
  const listedPrice = product.priceLabel || money(product.price);
  const message = product.category === "conta"
    ? `Olá! Tenho interesse na conta ${product.name} da XT Brazil. O preço anunciado é ${listedPrice}. Pode me passar mais detalhes e confirmar a disponibilidade?`
    : `Olá! Tenho interesse no item ${product.name} da Loja Prime Free Fire. O preço anunciado é ${listedPrice}. Pode confirmar a disponibilidade?`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a solicitação.");
  return result;
}

async function loadAccountCatalog() {
  try {
    const { accounts } = await apiRequest("/api/accounts");
    PRODUCTS.push(...accounts);
  } catch {
    // A loja estática continua mostrando os produtos locais quando a API não está disponível.
  }
}

async function refreshManagedAccountList() {
  const { accounts } = await apiRequest("/api/accounts");
  const list = $("#managedAccountList");
  list.innerHTML = accounts.length
    ? accounts.map((account) => `
      <div class="managed-account-row">
        <span>${escapeHtml(account.name)} — ${money(Number(account.price))}</span>
        <button type="button" data-remove-account="${escapeHtml(account.id)}">Remover</button>
      </div>
    `).join("")
    : '<p class="managed-account-empty">Nenhuma conta cadastrada no estoque.</p>';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function setOwnerPanel(authenticated) {
  ownerAuthenticated = authenticated;
  $("#adminLoginForm").hidden = authenticated;
  $("#accountAdminContent").hidden = !authenticated;
  if (authenticated) refreshManagedAccountList().catch((error) => {
    $("#adminLoginMessage").textContent = error.message;
  });
}

function setupAccountManager() {
  apiRequest("/api/session").then(({ authenticated }) => setOwnerPanel(authenticated)).catch(() => {
    $("#adminLoginMessage").textContent = "O servidor da loja precisa estar iniciado para liberar o painel.";
  });

  $("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const passwordInput = $("#adminPassword");
    const message = $("#adminLoginMessage");
    message.textContent = "Verificando acesso...";
    try {
      await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: passwordInput.value })
      });
      passwordInput.value = "";
      message.textContent = "Acesso liberado.";
      setOwnerPanel(true);
    } catch (error) {
      message.textContent = error.message;
    }
  });

  $("#adminLogout").addEventListener("click", async () => {
    try {
      await apiRequest("/api/logout", { method: "POST", body: "{}" });
      setOwnerPanel(false);
      $("#adminLoginMessage").textContent = "Você saiu do painel.";
    } catch (error) {
      $("#adminLoginMessage").textContent = error.message;
    }
  });

  $("#accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ownerAuthenticated) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const imageFile = formData.get("imageFile");
    const accountData = Object.fromEntries(formData.entries());
    delete accountData.imageFile;
    if (imageFile?.size) {
      if (imageFile.size > 3 * 1024 * 1024) {
        $("#adminLoginMessage").textContent = "A imagem deve ter no máximo 3 MB.";
        return;
      }
      try {
        accountData.imageData = await fileToDataUrl(imageFile);
      } catch (error) {
        $("#adminLoginMessage").textContent = error.message;
        return;
      }
    }
    try {
      const { account } = await apiRequest("/api/accounts", {
        method: "POST",
        body: JSON.stringify(accountData)
      });
      PRODUCTS.push(account);
      renderProducts();
      await refreshManagedAccountList();
      form.reset();
      showToast("Conta adicionada ao catálogo.");
    } catch (error) {
      $("#adminLoginMessage").textContent = error.message;
    }
  });

  $("#managedAccountList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-account]");
    if (!button || !ownerAuthenticated) return;
    try {
      await apiRequest(`/api/accounts/${encodeURIComponent(button.dataset.removeAccount)}`, { method: "DELETE" });
      const index = PRODUCTS.findIndex((product) => product.id === button.dataset.removeAccount);
      if (index !== -1) PRODUCTS.splice(index, 1);
      renderProducts();
      await refreshManagedAccountList();
      showToast("Conta removida do catálogo.");
    } catch (error) {
      $("#adminLoginMessage").textContent = error.message;
    }
  });
}

function setupDevicePicker() {
  $("#deviceBrand").addEventListener("change", (event) => {
    const models = deviceModels[event.target.value] || [];
    const select = $("#deviceModel");
    select.innerHTML = '<option value="">Selecione o modelo</option>' + models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("");
    select.disabled = models.length === 0;
  });
}

function setupTracking() {
  $("#trackingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = $("#trackingCode").value.trim();
    const message = `Olá! Gostaria de acompanhar meu pedido da XT Brazil. Código: ${code}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
}

function setupReveal() {
  const items =
    $$(".reveal");

  const observer =
    new IntersectionObserver(
      (entries, obs) => {

        entries.forEach(
          (entry) => {

            if (
              entry.isIntersecting
            ) {

              entry.target.classList.add(
                "visible"
              );

              obs.unobserve(
                entry.target
              );
            }

          }
        );

      },
      {
        threshold: 0.12
      }
    );

  items.forEach(
    (item) =>
      observer.observe(item)
  );
}

function setupCounters() {
  const counters =
    $$("[data-counter]");

  const observer =
    new IntersectionObserver(
      (entries, obs) => {

        entries.forEach(
          (entry) => {

            if (
              !entry.isIntersecting
            ) {
              return;
            }

            const target =
              Number(
                entry.target.dataset.counter ||
                0
              );

            let current = 0;

            const duration = 900;

            const start =
              performance.now();

            const step = (time) => {

              const progress =
                Math.min(
                  (time - start) /
                    duration,
                  1
                );

              current =
                Math.round(
                  target *
                    (1 -
                      Math.pow(
                        1 - progress,
                        3
                      ))
                );

              entry.target.textContent =
                current.toLocaleString(
                  "pt-BR"
                );

              if (
                progress < 1
              ) {
                requestAnimationFrame(
                  step
                );
              }
            };

            requestAnimationFrame(
              step
            );

            obs.unobserve(
              entry.target
            );
          }
        );

      },
      {
        threshold: 0.4
      }
    );

  counters.forEach(
    (counter) =>
      observer.observe(counter)
  );
}

function setupKeyboard() {
  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
      ) {

        closeCart();

        if (
          $("#productDialog").open
        ) {
          $("#productDialog").close();
        }

      }

    }
  );
}

setupAccountManager();
renderProducts();

updateCart();

setupMenu();

setupStore();

setupCart();

setupDialog();
setupDevicePicker();
setupTracking();

setupReveal();

setupCounters();

setupKeyboard();

loadAccountCatalog().then(renderProducts);
