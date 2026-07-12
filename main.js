(function () {
  const STORAGE_KEY = "autoPartsStoreDB";

  function getDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return {
      customers: [],
      suppliers: [],
      inventory: [],
      sales: [],
      purchases: [],
      payments: [],
      supplierPayments: [],
      salesReturns: [],
      purchaseReturns: [],
      nextIds: {
        customer: 1,
        supplier: 1,
        inventory: 1,
        sale: 1,
        purchase: 1,
        payment: 1,
        supplierPayment: 1,
        salesReturn: 1,
        purchaseReturn: 1,
      },
    };
  }

  function saveDB(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
  let db = getDB();

  function generateId(type) {
    if (!db.nextIds[type]) db.nextIds[type] = 1;
    const id = db.nextIds[type];
    db.nextIds[type] = id + 1;
    saveDB(db);
    return id;
  }

  // ============ دوال مساعدة ============
  function formatCurrency(amount) {
    const num = parseFloat(amount || 0);
    if (num % 1 === 0) {
      return num.toLocaleString("EG") + " s.p";
    }
    return (
      num.toLocaleString("EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " s.p"
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCustomerById(id) {
    return db.customers.find((c) => c.id === id);
  }
  function getSupplierById(id) {
    return db.suppliers.find((s) => s.id === id);
  }
  function getInventoryById(id) {
    return db.inventory.find((i) => i.id === id);
  }

  function updateCustomerBalance(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) return;

    // مجموع المبيعات غير المسددة
    const salesTotal = db.sales
      .filter((s) => s.customerId === customerId)
      .reduce((sum, s) => sum + (s.remaining || 0), 0);

    // مجموع المرتجعات (تقلل الدين)
    const returnsTotal = db.salesReturns
      .filter((r) => r.customerId === customerId)
      .reduce((sum, r) => {
        const sale = db.sales.find((s) => s.id === r.saleId);
        if (sale) return sum + r.quantity * sale.unitPrice;
        return sum;
      }, 0);

    // مجموع التسديدات
    const paymentsTotal = db.payments
      .filter((p) => p.customerId === customerId)
      .reduce((sum, p) => sum + p.amount, 0);

    customer.balance = salesTotal - returnsTotal - paymentsTotal;
    saveDB(db);
  }

  function updateSupplierBalance(supplierId) {
    const supplier = getSupplierById(supplierId);
    if (!supplier) return;

    // مجموع المشتريات غير المسددة
    const purchasesTotal = db.purchases
      .filter((p) => p.supplierId === supplierId)
      .reduce((sum, p) => sum + (p.remaining || 0), 0);

    // مجموع مرتجعات المشتريات
    const returnsTotal = db.purchaseReturns
      .filter((r) => r.supplierId === supplierId)
      .reduce((sum, r) => {
        const purchase = db.purchases.find((p) => p.id === r.purchaseId);
        if (purchase) return sum + r.quantity * purchase.unitPrice;
        return sum;
      }, 0);

    // مجموع المدفوعات للمورد
    const paymentsTotal = db.supplierPayments
      .filter((sp) => sp.supplierId === supplierId)
      .reduce((sum, sp) => sum + sp.amount, 0);

    supplier.balance = purchasesTotal - returnsTotal - paymentsTotal;
    saveDB(db);
  }

  function distributeCustomerPayment(customerId, amount) {
    const unpaidSales = db.sales
      .filter((s) => s.customerId === customerId && s.remaining > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = amount;
    for (const sale of unpaidSales) {
      if (remaining <= 0) break;
      const deduction = Math.min(sale.remaining, remaining);
      sale.remaining -= deduction;
      sale.paid += deduction;
      remaining -= deduction;
    }
  }

  function distributeSupplierPayment(supplierId, amount) {
    const unpaidPurchases = db.purchases
      .filter((p) => p.supplierId === supplierId && p.remaining > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = amount;
    for (const purchase of unpaidPurchases) {
      if (remaining <= 0) break;
      const deduction = Math.min(purchase.remaining, remaining);
      purchase.remaining -= deduction;
      purchase.paid += deduction;
      remaining -= deduction;
    }
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ============ التنقل بين الصفحات ============
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
  const pages = document.querySelectorAll(".page");
  const sidebar = document.getElementById("sidebar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");

  function navigateTo(pageName) {
    pages.forEach((p) => p.classList.remove("active"));
    sidebarLinks.forEach((l) => l.classList.remove("active"));
    const page = document.getElementById("page-" + pageName);
    if (page) page.classList.add("active");
    const link = document.querySelector(
      `.sidebar-nav a[data-page="${pageName}"]`,
    );
    if (link) link.classList.add("active");
    if (window.innerWidth <= 768) sidebar.classList.remove("open");
    refreshPage(pageName);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navigateTo(link.getAttribute("data-page"));
    });
  });

  mobileMenuBtn.addEventListener("click", () =>
    sidebar.classList.toggle("open"),
  );

  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      !sidebar.contains(e.target) &&
      e.target !== mobileMenuBtn &&
      !mobileMenuBtn.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  function refreshPage(pageName) {
    switch (pageName) {
      case "dashboard":
        renderDashboard();
        break;
      case "customers":
        renderCustomers();
        break;
      case "suppliers":
        renderSuppliers();
        break;
      case "inventory":
        renderInventory();
        break;
      case "sales":
        renderSales();
        break;
      case "purchases":
        renderPurchases();
        break;
      case "payments":
        renderPayments();
        break;
      case "supplier_payments":
        renderSupplierPayments();
        break;
      case "reports":
        renderReports();
        break;
    }
  }

  // ============ لوحة التحكم ============
  function renderDashboard() {
    const totalCustomers = db.customers.length;
    const totalSuppliers = db.suppliers.length;
    const totalInventoryItems = db.inventory.length;
    const totalInventoryQty = db.inventory.reduce(
      (s, i) => s + (i.quantity || 0),
      0,
    );
    const totalCustomerDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0,
    );
    const totalSupplierDebts = db.suppliers.reduce(
      (s, sup) => s + Math.max(0, sup.balance || 0),
      0,
    );
    const lowStock = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5),
    ).length;
    const totalSales = db.sales.reduce((s, sl) => s + (sl.total || 0), 0);
    const totalPurchases = db.purchases.reduce((s, p) => s + (p.total || 0), 0);

    document.getElementById("dashboardStats").innerHTML = `
            <div class="stat-card">
                <div class="stat-icon blue">👥</div>
                <div class="stat-info"><h3>العملاء</h3><div class="value">${totalCustomers}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">🏭</div>
                <div class="stat-info"><h3>الموردين</h3><div class="value">${totalSuppliers}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">📦</div>
                <div class="stat-info"><h3>القطع بالمخزون</h3><div class="value">${totalInventoryItems}</div><small>الكمية: ${totalInventoryQty}</small></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">💸</div>
                <div class="stat-info"><h3>ديون العملاء</h3><div class="value positive">${formatCurrency(totalCustomerDebts)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">🏦</div>
                <div class="stat-info"><h3>ديون للموردين</h3><div class="value">${formatCurrency(totalSupplierDebts)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">⚠️</div>
                <div class="stat-info"><h3>مخزون منخفض</h3><div class="value">${lowStock}</div></div>
            </div>
        `;

    // آخر العمليات
    const allOperations = [
      ...db.sales.map((s) => ({ type: "sale", data: s, date: s.date })),
      ...db.purchases.map((p) => ({ type: "purchase", data: p, date: p.date })),
      ...db.salesReturns.map((r) => ({
        type: "saleReturn",
        data: r,
        date: r.date,
      })),
      ...db.purchaseReturns.map((r) => ({
        type: "purchaseReturn",
        data: r,
        date: r.date,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    const activityDiv = document.getElementById("recentActivity");
    if (allOperations.length === 0) {
      activityDiv.innerHTML =
        '<p class="empty-state"><span class="empty-icon">📭</span>لا توجد عمليات حديثة</p>';
    } else {
      let html = '<ul style="list-style:none;padding:0;">';
      allOperations.forEach((op) => {
        let icon, text;
        switch (op.type) {
          case "sale":
            icon = "🛒";
            const c = getCustomerById(op.data.customerId);
            text = `بيع لـ ${c ? c.name : "؟"} - ${formatCurrency(op.data.total)}`;
            break;
          case "purchase":
            icon = "📥";
            const s = getSupplierById(op.data.supplierId);
            text = `شراء من ${s ? s.name : "؟"} - ${formatCurrency(op.data.total)}`;
            break;
          case "saleReturn":
            icon = "↩️";
            const cr = getCustomerById(op.data.customerId);
            text = `مرتجع بيع من ${cr ? cr.name : "؟"}`;
            break;
          case "purchaseReturn":
            icon = "↩️";
            const sr = getSupplierById(op.data.supplierId);
            text = `مرتجع شراء إلى ${sr ? sr.name : "؟"}`;
            break;
        }
        html += `<li style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                    ${icon} ${text} | ${formatDate(op.date)}
                </li>`;
      });
      html += "</ul>";
      activityDiv.innerHTML = html;
    }
  }

  // ============ العملاء ============
  function renderCustomers() {
    const search = (document.getElementById("customerSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.customers;
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(search) || c.phone.includes(search),
      );
    }
    const tbody = document.getElementById("customersTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">👤</span>لا يوجد عملاء</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((c) => {
        const balance = c.balance || 0;
        let statusBadge = "";
        if (balance > 0) {
          statusBadge =
            '<span class="badge badge-danger">مدين (' +
            formatCurrency(balance) +
            ")</span>";
        } else if (balance < 0) {
          statusBadge =
            '<span class="badge badge-success">دائن (' +
            formatCurrency(Math.abs(balance)) +
            ")</span>";
        } else {
          statusBadge = '<span class="badge badge-info">متوازن</span>';
        }
        return `
                <tr>
                    <td>${c.id}</td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone || "-"}</td>
                    <td>${c.address || "-"}</td>
                    <td>${formatCurrency(balance)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="editCustomer(${c.id})">✏️ تعديل</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteCustomer(${c.id})">🗑️ حذف</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openCustomerModal = function (customer = null) {
    const isEdit = customer !== null;
    const modalHTML = `
        <div class="modal-overlay" id="customerModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? "✏️ تعديل عميل" : "➕ إضافة عميل جديد"}</h3>
                    <button class="modal-close" onclick="closeModal('customerModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>الاسم *</label>
                        <input type="text" id="custName" value="${isEdit ? customer.name : ""}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>رقم الهاتف</label>
                            <input type="text" id="custPhone" value="${isEdit ? customer.phone || "" : ""}">
                        </div>
                        <div class="form-group">
                            <label>العنوان</label>
                            <input type="text" id="custAddress" value="${isEdit ? customer.address || "" : ""}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('customerModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveCustomer(${isEdit ? customer.id : "null"})">
                        💾 ${isEdit ? "تحديث" : "حفظ"}
                    </button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("custName")?.focus();
  };

  window.editCustomer = function (id) {
    const c = getCustomerById(id);
    if (c) window.openCustomerModal(c);
  };

  window.saveCustomer = function (id) {
    const name = document.getElementById("custName")?.value.trim();
    if (!name) {
      showToast("الرجاء إدخال اسم العميل", "error");
      return;
    }
    const phone = document.getElementById("custPhone")?.value.trim() || "";
    const address = document.getElementById("custAddress")?.value.trim() || "";

    if (id) {
      const c = getCustomerById(id);
      if (c) {
        c.name = name;
        c.phone = phone;
        c.address = address;
      }
    } else {
      db.customers.push({
        id: generateId("customer"),
        name,
        phone,
        address,
        balance: 0,
        createdAt: new Date().toISOString(),
      });
    }
    saveDB(db);
    closeModal("customerModalOverlay");
    renderCustomers();
    renderDashboard();
    showToast(id ? "تم تحديث العميل بنجاح ✅" : "تم إضافة العميل بنجاح ✅");
  };

  window.deleteCustomer = function (id) {
    const c = getCustomerById(id);
    if (!c) return;
    const hasSales = db.sales.some((s) => s.customerId === id);
    if (hasSales) {
      showToast("لا يمكن حذف العميل - لديه عمليات مبيعات مسجلة", "error");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العميل "${c.name}"؟`)) return;
    db.customers = db.customers.filter((x) => x.id !== id);
    db.payments = db.payments.filter((p) => p.customerId !== id);
    db.salesReturns = db.salesReturns.filter((r) => r.customerId !== id);
    saveDB(db);
    renderCustomers();
    renderDashboard();
    showToast("تم حذف العميل 🗑️");
  };

  // ============ الموردين ============
  function renderSuppliers() {
    const search = (document.getElementById("supplierSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.suppliers;
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(search) || s.phone.includes(search),
      );
    }
    const tbody = document.getElementById("suppliersTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🏭</span>لا يوجد موردين</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((s) => {
        const balance = s.balance || 0;
        let statusBadge = "";
        if (balance > 0) {
          statusBadge =
            '<span class="badge badge-danger">علينا (' +
            formatCurrency(balance) +
            ")</span>";
        } else if (balance < 0) {
          statusBadge =
            '<span class="badge badge-success">لنا (' +
            formatCurrency(Math.abs(balance)) +
            ")</span>";
        } else {
          statusBadge = '<span class="badge badge-info">متوازن</span>';
        }
        return `
                <tr>
                    <td>${s.id}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.phone || "-"}</td>
                    <td>${s.address || "-"}</td>
                    <td>${formatCurrency(balance)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="editSupplier(${s.id})">✏️ تعديل</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteSupplier(${s.id})">🗑️ حذف</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openSupplierModal = function (supplier = null) {
    const isEdit = supplier !== null;
    const modalHTML = `
        <div class="modal-overlay" id="supplierModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? "✏️ تعديل مورد" : "➕ إضافة مورد جديد"}</h3>
                    <button class="modal-close" onclick="closeModal('supplierModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>الاسم *</label>
                        <input type="text" id="supName" value="${isEdit ? supplier.name : ""}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>رقم الهاتف</label>
                            <input type="text" id="supPhone" value="${isEdit ? supplier.phone || "" : ""}">
                        </div>
                        <div class="form-group">
                            <label>العنوان</label>
                            <input type="text" id="supAddress" value="${isEdit ? supplier.address || "" : ""}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('supplierModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveSupplier(${isEdit ? supplier.id : "null"})">
                        💾 ${isEdit ? "تحديث" : "حفظ"}
                    </button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("supName")?.focus();
  };

  window.editSupplier = function (id) {
    const s = getSupplierById(id);
    if (s) window.openSupplierModal(s);
  };

  window.saveSupplier = function (id) {
    const name = document.getElementById("supName")?.value.trim();
    if (!name) {
      showToast("الرجاء إدخال اسم المورد", "error");
      return;
    }
    const phone = document.getElementById("supPhone")?.value.trim() || "";
    const address = document.getElementById("supAddress")?.value.trim() || "";

    if (id) {
      const s = getSupplierById(id);
      if (s) {
        s.name = name;
        s.phone = phone;
        s.address = address;
      }
    } else {
      db.suppliers.push({
        id: generateId("supplier"),
        name,
        phone,
        address,
        balance: 0,
        createdAt: new Date().toISOString(),
      });
    }
    saveDB(db);
    closeModal("supplierModalOverlay");
    renderSuppliers();
    renderDashboard();
    showToast(id ? "تم تحديث المورد بنجاح ✅" : "تم إضافة المورد بنجاح ✅");
  };

  window.deleteSupplier = function (id) {
    const s = getSupplierById(id);
    if (!s) return;
    const hasPurchases = db.purchases.some((p) => p.supplierId === id);
    if (hasPurchases) {
      showToast("لا يمكن حذف المورد - لديه فواتير شراء مسجلة", "error");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف المورد "${s.name}"؟`)) return;
    db.suppliers = db.suppliers.filter((x) => x.id !== id);
    db.supplierPayments = db.supplierPayments.filter(
      (p) => p.supplierId !== id,
    );
    db.purchaseReturns = db.purchaseReturns.filter((r) => r.supplierId !== id);
    saveDB(db);
    renderSuppliers();
    renderDashboard();
    showToast("تم حذف المورد 🗑️");
  };

  // ============ المستودع ============
  function renderInventory() {
    const search = (document.getElementById("inventorySearch")?.value || "")
      .trim()
      .toLowerCase();
    const catFilter = document.getElementById("categoryFilter")?.value || "";
    let filtered = db.inventory;

    if (search) {
      filtered = filtered.filter(
        (i) =>
          i.partName.toLowerCase().includes(search) ||
          (i.partNumber || "").toLowerCase().includes(search) ||
          (i.supplier || "").toLowerCase().includes(search),
      );
    }
    if (catFilter) {
      filtered = filtered.filter((i) => i.category === catFilter);
    }

    const tbody = document.getElementById("inventoryTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11"><div class="empty-state"><span class="empty-icon">📦</span>المستودع فارغ</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((i) => {
        const lowStock = i.quantity <= (i.minAlert || 5);
        const imgTag = i.image
          ? `<img src="${i.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" alt="${i.partName}">`
          : '<span style="font-size:20px;">🚫</span>';

        return `
                <tr style="${lowStock ? "background:#fff5f5" : ""}">
                    <td>${i.id}</td>
                    <td>${imgTag}</td>
                    <td><strong>${i.partName}</strong></td>
                    <td>${i.partNumber || "-"}</td>
                    <td><span class="badge badge-info">${i.category || "أخرى"}</span></td>
                    <td><strong>${i.quantity}</strong></td>
                    <td>${formatCurrency(i.purchasePrice)}</td>
                    <td>${formatCurrency(i.sellingPrice)}</td>
                    <td>${i.supplier || "-"}</td>
                    <td>${lowStock ? '<span class="badge badge-danger">⚠️ منخفض</span>' : '<span class="badge badge-success">✅ جيد</span>'}</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="editInventory(${i.id})">✏️</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteInventory(${i.id})">🗑️</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openInventoryModal = function (item = null) {
    const isEdit = item !== null;
    const categories = [
      "محرك",
      "ناقل حركة",
      "فرامل",
      "تعليق",
      "كهرباء",
      "تكييف",
      "إطارات",
      "بطاريات",
      "فلاتر",
      "زيوت",
      "أخرى",
    ];
    const catOptions = categories
      .map(
        (c) =>
          `<option value="${c}" ${isEdit && item.category === c ? "selected" : ""}>${c}</option>`,
      )
      .join("");

    const modalHTML = `
        <div class="modal-overlay" id="inventoryModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? "✏️ تعديل قطعة" : "➕ إضافة قطعة جديدة"}</h3>
                    <button class="modal-close" onclick="closeModal('inventoryModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>صورة القطعة</label>
                        <input type="file" id="partImage" accept="image/*" onchange="previewPartImage()">
                        <img id="partImagePreview" src="${isEdit && item.image ? item.image : ""}" 
                             style="max-width:100px;max-height:100px;margin-top:5px;display:${isEdit && item.image ? "block" : "none"};">
                    </div>
                    <div class="form-group">
                        <label>اسم القطعة *</label>
                        <input type="text" id="partName" value="${isEdit ? item.partName : ""}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>رقم القطعة</label>
                            <input type="text" id="partNumber" value="${isEdit ? item.partNumber || "" : ""}">
                        </div>
                        <div class="form-group">
                            <label>الفئة</label>
                            <select id="partCategory">${catOptions}</select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>الكمية *</label>
                            <input type="number" id="partQty" value="${isEdit ? item.quantity : 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label>الحد الأدنى للتنبيه</label>
                            <input type="number" id="partMinAlert" value="${isEdit ? item.minAlert || 5 : 5}" min="1">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>سعر الشراء</label>
                            <input type="number" id="partPurchasePrice" value="${isEdit ? item.purchasePrice || 0 : 0}" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>سعر البيع *</label>
                            <input type="number" id="partSellingPrice" value="${isEdit ? item.sellingPrice || 0 : 0}" step="0.01">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>المورد</label>
                        <input type="text" id="partSupplier" value="${isEdit ? item.supplier || "" : ""}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('inventoryModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveInventory(${isEdit ? item.id : "null"})">
                        💾 ${isEdit ? "تحديث" : "حفظ"}
                    </button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
  };

  window.previewPartImage = function () {
    const file = document.getElementById("partImage")?.files[0];
    const preview = document.getElementById("partImagePreview");
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  };

  window.editInventory = function (id) {
    const item = getInventoryById(id);
    if (item) window.openInventoryModal(item);
  };

  window.saveInventory = function (id) {
    const partName = document.getElementById("partName")?.value.trim();
    if (!partName) {
      showToast("الرجاء إدخال اسم القطعة", "error");
      return;
    }

    const partNumber =
      document.getElementById("partNumber")?.value.trim() || "";
    const category = document.getElementById("partCategory")?.value || "أخرى";
    const quantity = parseInt(document.getElementById("partQty")?.value) || 0;
    const minAlert =
      parseInt(document.getElementById("partMinAlert")?.value) || 5;
    const purchasePrice =
      parseFloat(document.getElementById("partPurchasePrice")?.value) || 0;
    const sellingPrice =
      parseFloat(document.getElementById("partSellingPrice")?.value) || 0;
    if (sellingPrice <= 0) {
      showToast("الرجاء إدخال سعر بيع صحيح", "error");
      return;
    }
    const supplier =
      document.getElementById("partSupplier")?.value.trim() || "";

    const imageInput = document.getElementById("partImage");
    let image = id ? getInventoryById(id)?.image || null : null;

    const finalizeSave = (imgData) => {
      const data = {
        partName,
        partNumber,
        category,
        quantity,
        minAlert,
        purchasePrice,
        sellingPrice,
        supplier,
        image: imgData,
      };

      if (id) {
        const item = getInventoryById(id);
        if (item) Object.assign(item, data);
      } else {
        db.inventory.push({
          id: generateId("inventory"),
          ...data,
          createdAt: new Date().toISOString(),
        });
      }

      saveDB(db);
      closeModal("inventoryModalOverlay");
      renderInventory();
      renderDashboard();
      showToast(id ? "تم تحديث القطعة ✅" : "تم إضافة القطعة ✅");
    };

    if (imageInput && imageInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => finalizeSave(e.target.result);
      reader.readAsDataURL(imageInput.files[0]);
    } else {
      finalizeSave(image);
    }
  };

  window.deleteInventory = function (id) {
    const item = getInventoryById(id);
    if (!item) return;
    const hasSales = db.sales.some((s) => s.inventoryId === id);
    const hasPurchases = db.purchases.some((p) => p.inventoryId === id);
    if (hasSales || hasPurchases) {
      showToast("لا يمكن حذف القطعة - لديها فواتير مسجلة", "error");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف "${item.partName}"؟`)) return;
    db.inventory = db.inventory.filter((x) => x.id !== id);
    saveDB(db);
    renderInventory();
    renderDashboard();
    showToast("تم حذف القطعة 🗑️");
  };

  // ============ المبيعات ============
  function renderSales() {
    const search = (document.getElementById("saleSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.sales;
    if (search) {
      filtered = filtered.filter((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        return (
          (c && c.name.toLowerCase().includes(search)) ||
          (inv && inv.partName.toLowerCase().includes(search))
        );
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById("salesTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state"><span class="empty-icon">🛒</span>لا توجد مبيعات</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        const returns = db.salesReturns
          .filter((r) => r.saleId === s.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const netQty = s.quantity - returns;
        const statusBadge =
          s.remaining <= 0
            ? '<span class="badge badge-success">✅ مسدد</span>'
            : '<span class="badge badge-danger">📌 عليه دين</span>';

        return `
                <tr>
                    <td>${s.id}</td>
                    <td>${formatDate(s.date)}</td>
                    <td>${c ? c.name : '<span style="color:#999">محذوف</span>'}</td>
                    <td>${inv ? inv.partName : '<span style="color:#999">محذوفة</span>'}</td>
                    <td>
                        ${netQty} 
                        ${returns > 0 ? `<small style="color:var(--danger)">(مرتجع ${returns})</small>` : ""}
                    </td>
                    <td>${formatCurrency(s.total)}</td>
                    <td>${formatCurrency(s.paid)}</td>
                    <td><strong style="color:${s.remaining > 0 ? "var(--danger)" : "var(--success)"}">${formatCurrency(s.remaining)}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-danger btn-xs" onclick="deleteSale(${s.id})">🗑️</button>
                        <button class="btn btn-xs" onclick="openSalesReturnModal(${s.id})" 
                                style="background:var(--warning);color:#fff;border:none;">↩️ مرتجع</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openSaleModal = function () {
    if (db.customers.length === 0) {
      showToast("الرجاء إضافة عميل أولاً", "error");
      return;
    }
    const availInv = db.inventory.filter((i) => i.quantity > 0);
    if (availInv.length === 0) {
      showToast("لا توجد قطع متاحة في المخزون", "error");
      return;
    }

    const customerOptions = db.customers
      .map(
        (c) =>
          `<option value="${c.id}">${c.name} - ${c.phone || ""} (رصيد: ${formatCurrency(c.balance || 0)})</option>`,
      )
      .join("");
    const inventoryOptions = availInv
      .map(
        (i) =>
          `<option value="${i.id}" data-price="${i.sellingPrice}" data-purchase="${i.purchasePrice}" data-stock="${i.quantity}">
                ${i.partName} - ${formatCurrency(i.sellingPrice)} (المتاح: ${i.quantity})
            </option>`,
      )
      .join("");

    const modalHTML = `
        <div class="modal-overlay" id="saleModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>🛒 تسجيل عملية بيع</h3>
                    <button class="modal-close" onclick="closeModal('saleModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>العميل *</label>
                        <select id="saleCustomer">${customerOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>القطعة *</label>
                        <select id="saleInventory" onchange="updateSalePrice()">${inventoryOptions}</select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>الكمية *</label>
                            <input type="number" id="saleQty" value="1" min="1" oninput="updateSaleTotal()">
                        </div>
                        <div class="form-group">
                            <label>سعر البيع للوحدة</label>
                            <input type="number" id="saleUnitPrice" step="0.01" oninput="updateSaleTotal()">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>الإجمالي</label>
                            <input type="number" id="saleTotal" readonly style="background:#f1f5f9;font-weight:700;">
                        </div>
                        <div class="form-group">
                            <label>المبلغ المدفوع</label>
                            <input type="number" id="salePaid" value="0" min="0" step="0.01" oninput="updateSaleRemaining()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>المتبقي (الدين)</label>
                        <input type="number" id="saleRemaining" readonly style="background:#fef3c7;font-weight:700;color:var(--danger);">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('saleModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveSale()">💾 تسجيل البيع</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    updateSalePrice();
    updateSaleTotal();
  };

  window.updateSalePrice = function () {
    const invSelect = document.getElementById("saleInventory");
    const priceInput = document.getElementById("saleUnitPrice");
    if (invSelect && priceInput && invSelect.selectedOptions[0]) {
      priceInput.value =
        invSelect.selectedOptions[0].getAttribute("data-price") || 0;
    }
    updateSaleTotal();
  };

  window.updateSaleTotal = function () {
    const qty = parseInt(document.getElementById("saleQty")?.value) || 0;
    const price =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const totalInput = document.getElementById("saleTotal");
    if (totalInput) totalInput.value = (qty * price).toFixed(2);
    updateSaleRemaining();
  };

  window.updateSaleRemaining = function () {
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const remainingInput = document.getElementById("saleRemaining");
    if (remainingInput)
      remainingInput.value = Math.max(0, total - paid).toFixed(2);
  };

  window.saveSale = function () {
    const customerId = parseInt(document.getElementById("saleCustomer")?.value);
    const inventoryId = parseInt(
      document.getElementById("saleInventory")?.value,
    );
    const quantity = parseInt(document.getElementById("saleQty")?.value) || 0;
    const unitPrice =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const remaining = Math.max(0, total - paid);

    if (!customerId || !inventoryId) {
      showToast("الرجاء اختيار العميل والقطعة", "error");
      return;
    }
    if (quantity <= 0) {
      showToast("الرجاء إدخال كمية صحيحة", "error");
      return;
    }
    if (unitPrice <= 0) {
      showToast("الرجاء إدخال سعر بيع صحيح", "error");
      return;
    }

    const inv = getInventoryById(inventoryId);
    if (!inv) {
      showToast("القطعة غير موجودة", "error");
      return;
    }
    if (inv.quantity < quantity) {
      showToast(`المخزون غير كافٍ! المتاح: ${inv.quantity}`, "error");
      return;
    }

    inv.quantity -= quantity;

    const sale = {
      id: generateId("sale"),
      customerId,
      inventoryId,
      quantity,
      unitPrice,
      total,
      paid,
      remaining,
      purchasePriceAtSale: inv.purchasePrice || 0,
      date: new Date().toISOString(),
    };
    db.sales.push(sale);
    updateCustomerBalance(customerId);
    saveDB(db);

    closeModal("saleModalOverlay");
    renderSales();
    renderInventory();
    renderDashboard();
    showToast(
      `تم تسجيل البيع بنجاح ✅ ${remaining > 0 ? "(دين: " + formatCurrency(remaining) + ")" : "(مدفوع كاملاً)"}`,
    );
  };

  window.deleteSale = function (id) {
    const sale = db.sales.find((s) => s.id === id);
    if (!sale) return;
    if (!confirm("هل أنت متأكد من حذف عملية البيع؟ سيتم إرجاع الكمية للمخزون."))
      return;

    const inv = getInventoryById(sale.inventoryId);
    if (inv) inv.quantity += sale.quantity;

    const returns = db.salesReturns.filter((r) => r.saleId === id);
    returns.forEach((r) => {
      const inv2 = getInventoryById(r.inventoryId);
      if (inv2) inv2.quantity += r.quantity;
    });

    db.salesReturns = db.salesReturns.filter((r) => r.saleId !== id);
    db.sales = db.sales.filter((s) => s.id !== id);
    updateCustomerBalance(sale.customerId);
    saveDB(db);
    renderSales();
    renderInventory();
    renderDashboard();
    showToast("تم حذف البيع وإرجاع الكمية للمخزون 🗑️");
  };

  // مرتجعات المبيعات
  window.openSalesReturnModal = function (saleId) {
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const inv = getInventoryById(sale.inventoryId);
    const alreadyReturned = db.salesReturns
      .filter((r) => r.saleId === saleId)
      .reduce((sum, r) => sum + r.quantity, 0);
    const maxReturn = sale.quantity - alreadyReturned;

    if (maxReturn <= 0) {
      showToast("لا يمكن إرجاع كمية إضافية", "error");
      return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="salesReturnModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>↩️ مرتجع بيع - فاتورة #${sale.id}</h3>
                    <button class="modal-close" onclick="closeModal('salesReturnModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <p><strong>القطعة:</strong> ${inv ? inv.partName : "غير معروفة"}</p>
                    <p><strong>الكمية المباعة:</strong> ${sale.quantity}</p>
                    <p><strong>الكمية المتاحة للإرجاع:</strong> ${maxReturn}</p>
                    <div class="form-group">
                        <label>الكمية المرتجعة *</label>
                        <input type="number" id="returnQty" min="1" max="${maxReturn}" value="1">
                    </div>
                    <div class="form-group">
                        <label>سبب الإرجاع</label>
                        <input type="text" id="returnReason" placeholder="مثال: قطعة تالفة، خطأ في الطلب...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('salesReturnModalOverlay')">إلغاء</button>
                    <button class="btn btn-danger" onclick="saveSalesReturn(${saleId})">✅ تأكيد المرتجع</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
  };

  window.saveSalesReturn = function (saleId) {
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return;

    const qty = parseInt(document.getElementById("returnQty")?.value) || 0;
    const reason = document.getElementById("returnReason")?.value.trim() || "";
    const alreadyReturned = db.salesReturns
      .filter((r) => r.saleId === saleId)
      .reduce((sum, r) => sum + r.quantity, 0);

    if (qty <= 0 || qty > sale.quantity - alreadyReturned) {
      showToast("كمية غير صالحة", "error");
      return;
    }

    const inv = getInventoryById(sale.inventoryId);
    if (inv) inv.quantity += qty;

    db.salesReturns.push({
      id: generateId("salesReturn"),
      saleId,
      customerId: sale.customerId,
      inventoryId: sale.inventoryId,
      quantity: qty,
      date: new Date().toISOString(),
      reason,
    });

    updateCustomerBalance(sale.customerId);
    saveDB(db);
    closeModal("salesReturnModalOverlay");
    renderSales();
    renderInventory();
    renderDashboard();
    showToast(`تم تسجيل مرتجع (${qty} قطعة) بنجاح ✅`);
  };

  // ============ المشتريات ============
  function renderPurchases() {
    const search = (document.getElementById("purchaseSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.purchases;
    if (search) {
      filtered = filtered.filter((p) => {
        const s = getSupplierById(p.supplierId);
        const inv = getInventoryById(p.inventoryId);
        return (
          (s && s.name.toLowerCase().includes(search)) ||
          (inv && inv.partName.toLowerCase().includes(search))
        );
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById("purchasesTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state"><span class="empty-icon">📥</span>لا توجد مشتريات</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((p) => {
        const s = getSupplierById(p.supplierId);
        const inv = getInventoryById(p.inventoryId);
        const returns = db.purchaseReturns
          .filter((r) => r.purchaseId === p.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const netQty = p.quantity - returns;
        const statusBadge =
          p.remaining <= 0
            ? '<span class="badge badge-success">✅ مسدد</span>'
            : '<span class="badge badge-danger">📌 دين للمورد</span>';

        return `
                <tr>
                    <td>${p.id}</td>
                    <td>${formatDate(p.date)}</td>
                    <td>${s ? s.name : '<span style="color:#999">محذوف</span>'}</td>
                    <td>${inv ? inv.partName : '<span style="color:#999">محذوفة</span>'}</td>
                    <td>
                        ${netQty}
                        ${returns > 0 ? `<small style="color:var(--danger)">(مرتجع ${returns})</small>` : ""}
                    </td>
                    <td>${formatCurrency(p.total)}</td>
                    <td>${formatCurrency(p.paid)}</td>
                    <td><strong style="color:${p.remaining > 0 ? "var(--danger)" : "var(--success)"}">${formatCurrency(p.remaining)}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-danger btn-xs" onclick="deletePurchase(${p.id})">🗑️</button>
                        <button class="btn btn-xs" onclick="openPurchaseReturnModal(${p.id})" 
                                style="background:var(--warning);color:#fff;border:none;">↩️ مرتجع</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openPurchaseModal = function () {
    if (db.suppliers.length === 0) {
      showToast("الرجاء إضافة مورد أولاً", "error");
      return;
    }

    const supplierOptions = db.suppliers
      .map(
        (s) =>
          `<option value="${s.id}">${s.name} (رصيد: ${formatCurrency(s.balance || 0)})</option>`,
      )
      .join("");
    const inventoryOptions = db.inventory
      .map(
        (i) =>
          `<option value="${i.id}" data-purchase="${i.purchasePrice}">
                ${i.partName} (سعر الشراء الحالي: ${formatCurrency(i.purchasePrice)})
            </option>`,
      )
      .join("");

    const modalHTML = `
        <div class="modal-overlay" id="purchaseModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>🧾 تسجيل عملية شراء من مورد</h3>
                    <button class="modal-close" onclick="closeModal('purchaseModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>المورد *</label>
                        <select id="purchaseSupplier">${supplierOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>القطعة *</label>
                        <select id="purchaseInventory" onchange="updatePurchasePrice()">${inventoryOptions}</select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>الكمية *</label>
                            <input type="number" id="purchaseQty" value="1" min="1" oninput="updatePurchaseTotal()">
                        </div>
                        <div class="form-group">
                            <label>سعر شراء الوحدة</label>
                            <input type="number" id="purchaseUnitPrice" step="0.01" oninput="updatePurchaseTotal()">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>الإجمالي</label>
                            <input type="number" id="purchaseTotal" readonly style="background:#f1f5f9;font-weight:700;">
                        </div>
                        <div class="form-group">
                            <label>المبلغ المدفوع</label>
                            <input type="number" id="purchasePaid" value="0" min="0" step="0.01" oninput="updatePurchaseRemaining()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>المتبقي (دين للمورد)</label>
                        <input type="number" id="purchaseRemaining" readonly style="background:#fef3c7;font-weight:700;color:var(--danger);">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('purchaseModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="savePurchase()">💾 تسجيل الشراء</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    updatePurchasePrice();
    updatePurchaseTotal();
  };

  window.updatePurchasePrice = function () {
    const invSelect = document.getElementById("purchaseInventory");
    const priceInput = document.getElementById("purchaseUnitPrice");
    if (invSelect && priceInput && invSelect.selectedOptions[0]) {
      priceInput.value =
        invSelect.selectedOptions[0].getAttribute("data-purchase") || 0;
    }
    updatePurchaseTotal();
  };

  window.updatePurchaseTotal = function () {
    const qty = parseInt(document.getElementById("purchaseQty")?.value) || 0;
    const price =
      parseFloat(document.getElementById("purchaseUnitPrice")?.value) || 0;
    const totalInput = document.getElementById("purchaseTotal");
    if (totalInput) totalInput.value = (qty * price).toFixed(2);
    updatePurchaseRemaining();
  };

  window.updatePurchaseRemaining = function () {
    const total =
      parseFloat(document.getElementById("purchaseTotal")?.value) || 0;
    const paid =
      parseFloat(document.getElementById("purchasePaid")?.value) || 0;
    const remainingInput = document.getElementById("purchaseRemaining");
    if (remainingInput)
      remainingInput.value = Math.max(0, total - paid).toFixed(2);
  };

  window.savePurchase = function () {
    const supplierId = parseInt(
      document.getElementById("purchaseSupplier")?.value,
    );
    const inventoryId = parseInt(
      document.getElementById("purchaseInventory")?.value,
    );
    const quantity =
      parseInt(document.getElementById("purchaseQty")?.value) || 0;
    const unitPrice =
      parseFloat(document.getElementById("purchaseUnitPrice")?.value) || 0;
    const total =
      parseFloat(document.getElementById("purchaseTotal")?.value) || 0;
    const paid =
      parseFloat(document.getElementById("purchasePaid")?.value) || 0;
    const remaining = Math.max(0, total - paid);

    if (!supplierId || !inventoryId) {
      showToast("الرجاء اختيار المورد والقطعة", "error");
      return;
    }
    if (quantity <= 0) {
      showToast("الرجاء إدخال كمية صحيحة", "error");
      return;
    }
    if (unitPrice <= 0) {
      showToast("الرجاء إدخال سعر شراء صحيح", "error");
      return;
    }

    const inv = getInventoryById(inventoryId);
    if (!inv) {
      showToast("القطعة غير موجودة", "error");
      return;
    }

    // زيادة المخزون وتحديث سعر الشراء
    inv.quantity += quantity;
    inv.purchasePrice = unitPrice;

    const purchase = {
      id: generateId("purchase"),
      supplierId,
      inventoryId,
      quantity,
      unitPrice,
      total,
      paid,
      remaining,
      date: new Date().toISOString(),
    };
    db.purchases.push(purchase);
    updateSupplierBalance(supplierId);
    saveDB(db);

    closeModal("purchaseModalOverlay");
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast(
      `تم تسجيل الشراء بنجاح ✅ ${remaining > 0 ? "(دين: " + formatCurrency(remaining) + ")" : "(مدفوع كاملاً)"}`,
    );
  };

  window.deletePurchase = function (id) {
    const purchase = db.purchases.find((p) => p.id === id);
    if (!purchase) return;
    if (
      !confirm(
        "هل أنت متأكد من حذف عملية الشراء؟ سيتم إنقاص الكمية من المخزون.",
      )
    )
      return;

    const inv = getInventoryById(purchase.inventoryId);
    if (inv) inv.quantity = Math.max(0, inv.quantity - purchase.quantity);

    const returns = db.purchaseReturns.filter((r) => r.purchaseId === id);
    returns.forEach((r) => {
      const inv2 = getInventoryById(r.inventoryId);
      if (inv2) inv2.quantity = Math.max(0, inv2.quantity - r.quantity);
    });

    db.purchaseReturns = db.purchaseReturns.filter((r) => r.purchaseId !== id);
    db.purchases = db.purchases.filter((p) => p.id !== id);
    updateSupplierBalance(purchase.supplierId);
    saveDB(db);
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast("تم حذف الشراء 🗑️");
  };

  // مرتجعات المشتريات
  window.openPurchaseReturnModal = function (purchaseId) {
    const purchase = db.purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;
    const inv = getInventoryById(purchase.inventoryId);
    const alreadyReturned = db.purchaseReturns
      .filter((r) => r.purchaseId === purchaseId)
      .reduce((sum, r) => sum + r.quantity, 0);
    const maxReturn = purchase.quantity - alreadyReturned;

    if (maxReturn <= 0) {
      showToast("لا يمكن إرجاع كمية إضافية", "error");
      return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="purchaseReturnModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>↩️ مرتجع شراء - فاتورة #${purchase.id}</h3>
                    <button class="modal-close" onclick="closeModal('purchaseReturnModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <p><strong>القطعة:</strong> ${inv ? inv.partName : "غير معروفة"}</p>
                    <p><strong>الكمية المشتراة:</strong> ${purchase.quantity}</p>
                    <p><strong>الكمية المتاحة للإرجاع:</strong> ${maxReturn}</p>
                    <div class="form-group">
                        <label>الكمية المرتجعة *</label>
                        <input type="number" id="purchaseReturnQty" min="1" max="${maxReturn}" value="1">
                    </div>
                    <div class="form-group">
                        <label>سبب الإرجاع</label>
                        <input type="text" id="purchaseReturnReason" placeholder="مثال: قطعة تالفة، خطأ في الشحنة...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('purchaseReturnModalOverlay')">إلغاء</button>
                    <button class="btn btn-danger" onclick="savePurchaseReturn(${purchaseId})">✅ تأكيد المرتجع</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
  };

  window.savePurchaseReturn = function (purchaseId) {
    const purchase = db.purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;

    const qty =
      parseInt(document.getElementById("purchaseReturnQty")?.value) || 0;
    const reason =
      document.getElementById("purchaseReturnReason")?.value.trim() || "";
    const alreadyReturned = db.purchaseReturns
      .filter((r) => r.purchaseId === purchaseId)
      .reduce((sum, r) => sum + r.quantity, 0);

    if (qty <= 0 || qty > purchase.quantity - alreadyReturned) {
      showToast("كمية غير صالحة", "error");
      return;
    }

    const inv = getInventoryById(purchase.inventoryId);
    if (inv) inv.quantity = Math.max(0, inv.quantity - qty);

    db.purchaseReturns.push({
      id: generateId("purchaseReturn"),
      purchaseId,
      supplierId: purchase.supplierId,
      inventoryId: purchase.inventoryId,
      quantity: qty,
      date: new Date().toISOString(),
      reason,
    });

    updateSupplierBalance(purchase.supplierId);
    saveDB(db);
    closeModal("purchaseReturnModalOverlay");
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast(`تم تسجيل مرتجع شراء (${qty} قطعة) بنجاح ✅`);
  };

  // ============ تسديدات العملاء ============
  function renderPayments() {
    const search = (document.getElementById("paymentSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.payments;
    if (search) {
      filtered = filtered.filter((p) => {
        const c = getCustomerById(p.customerId);
        return c && c.name.toLowerCase().includes(search);
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById("paymentsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">💳</span>لا توجد تسديدات</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((p) => {
        const c = getCustomerById(p.customerId);
        return `
                <tr>
                    <td>${p.id}</td>
                    <td>${formatDate(p.date)}</td>
                    <td>${c ? c.name : '<span style="color:#999">محذوف</span>'}</td>
                    <td><strong style="color:var(--success)">${formatCurrency(p.amount)}</strong></td>
                    <td>${p.note || "-"}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="deletePayment(${p.id})">🗑️</button></td>
                </tr>`;
      })
      .join("");
  }

  window.openPaymentModal = function () {
    const allCustomers = db.customers.length > 0 ? db.customers : [];
    if (allCustomers.length === 0) {
      showToast("لا يوجد عملاء. الرجاء إضافة عميل أولاً.", "error");
      return;
    }

    const customerOptions = allCustomers
      .map(
        (c) =>
          `<option value="${c.id}">${c.name} - رصيد: ${formatCurrency(c.balance || 0)} ${(c.balance || 0) > 0 ? "🔴 مدين" : ""}</option>`,
      )
      .join("");

    const modalHTML = `
        <div class="modal-overlay" id="paymentModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>💵 تسجيل دفعة من عميل</h3>
                    <button class="modal-close" onclick="closeModal('paymentModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>العميل *</label>
                        <select id="paymentCustomer">${customerOptions}</select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>المبلغ *</label>
                            <input type="number" id="paymentAmount" min="0.01" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>التاريخ</label>
                            <input type="date" id="paymentDate" value="${new Date().toISOString().split("T")[0]}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>ملاحظات</label>
                        <textarea id="paymentNote" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('paymentModalOverlay')">إلغاء</button>
                    <button class="btn btn-success" onclick="savePayment()">💾 تسجيل الدفعة</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("paymentAmount")?.focus();
  };

  window.savePayment = function () {
    const customerId = parseInt(
      document.getElementById("paymentCustomer")?.value,
    );
    const amount =
      parseFloat(document.getElementById("paymentAmount")?.value) || 0;
    const date =
      document.getElementById("paymentDate")?.value ||
      new Date().toISOString().split("T")[0];
    const note = document.getElementById("paymentNote")?.value.trim() || "";

    if (!customerId) {
      showToast("الرجاء اختيار العميل", "error");
      return;
    }
    if (amount <= 0) {
      showToast("الرجاء إدخال مبلغ صحيح", "error");
      return;
    }

    // توزيع الدفع على الفواتير غير المسددة
    distributeCustomerPayment(customerId, amount);

    db.payments.push({
      id: generateId("payment"),
      customerId,
      amount,
      date: new Date(date).toISOString(),
      note,
      createdAt: new Date().toISOString(),
    });

    updateCustomerBalance(customerId);
    saveDB(db);
    closeModal("paymentModalOverlay");
    renderPayments();
    renderSales();
    renderDashboard();
    renderCustomers();
    showToast("تم تسجيل الدفعة بنجاح 💵");
  };

  window.deletePayment = function (id) {
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) return;
    if (!confirm("هل أنت متأكد من حذف هذه الدفعة؟")) return;

    db.payments = db.payments.filter((p) => p.id !== id);
    updateCustomerBalance(payment.customerId);
    saveDB(db);
    renderPayments();
    renderDashboard();
    renderCustomers();
    showToast("تم حذف الدفعة 🗑️");
  };

  // ============ مدفوعات الموردين ============
  function renderSupplierPayments() {
    const search = (
      document.getElementById("supplierPaymentSearch")?.value || ""
    )
      .trim()
      .toLowerCase();
    let filtered = db.supplierPayments;
    if (search) {
      filtered = filtered.filter((sp) => {
        const s = getSupplierById(sp.supplierId);
        return s && s.name.toLowerCase().includes(search);
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById("supplierPaymentsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🏦</span>لا توجد مدفوعات للموردين</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((sp) => {
        const s = getSupplierById(sp.supplierId);
        return `
                <tr>
                    <td>${sp.id}</td>
                    <td>${formatDate(sp.date)}</td>
                    <td>${s ? s.name : '<span style="color:#999">محذوف</span>'}</td>
                    <td><strong style="color:var(--danger)">${formatCurrency(sp.amount)}</strong></td>
                    <td>${sp.note || "-"}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="deleteSupplierPayment(${sp.id})">🗑️</button></td>
                </tr>`;
      })
      .join("");
  }

  window.openSupplierPaymentModal = function () {
    const allSuppliers = db.suppliers.length > 0 ? db.suppliers : [];
    if (allSuppliers.length === 0) {
      showToast("لا يوجد موردين. الرجاء إضافة مورد أولاً.", "error");
      return;
    }

    const supplierOptions = allSuppliers
      .map(
        (s) =>
          `<option value="${s.id}">${s.name} - رصيد: ${formatCurrency(s.balance || 0)} ${(s.balance || 0) > 0 ? "🔴 علينا دين" : ""}</option>`,
      )
      .join("");

    const modalHTML = `
        <div class="modal-overlay" id="supplierPaymentModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>💵 تسجيل دفعة لمورد</h3>
                    <button class="modal-close" onclick="closeModal('supplierPaymentModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>المورد *</label>
                        <select id="supplierPaymentSupplier">${supplierOptions}</select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>المبلغ *</label>
                            <input type="number" id="supplierPaymentAmount" min="0.01" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>التاريخ</label>
                            <input type="date" id="supplierPaymentDate" value="${new Date().toISOString().split("T")[0]}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>ملاحظات</label>
                        <textarea id="supplierPaymentNote" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('supplierPaymentModalOverlay')">إلغاء</button>
                    <button class="btn btn-success" onclick="saveSupplierPayment()">💾 تسجيل الدفعة</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("supplierPaymentAmount")?.focus();
  };

  window.saveSupplierPayment = function () {
    const supplierId = parseInt(
      document.getElementById("supplierPaymentSupplier")?.value,
    );
    const amount =
      parseFloat(document.getElementById("supplierPaymentAmount")?.value) || 0;
    const date =
      document.getElementById("supplierPaymentDate")?.value ||
      new Date().toISOString().split("T")[0];
    const note =
      document.getElementById("supplierPaymentNote")?.value.trim() || "";

    if (!supplierId) {
      showToast("الرجاء اختيار المورد", "error");
      return;
    }
    if (amount <= 0) {
      showToast("الرجاء إدخال مبلغ صحيح", "error");
      return;
    }

    // توزيع الدفع على فواتير الشراء غير المسددة
    distributeSupplierPayment(supplierId, amount);

    db.supplierPayments.push({
      id: generateId("supplierPayment"),
      supplierId,
      amount,
      date: new Date(date).toISOString(),
      note,
      createdAt: new Date().toISOString(),
    });

    updateSupplierBalance(supplierId);
    saveDB(db);
    closeModal("supplierPaymentModalOverlay");
    renderSupplierPayments();
    renderPurchases();
    renderDashboard();
    renderSuppliers();
    showToast("تم تسجيل الدفعة للمورد بنجاح 💵");
  };

  window.deleteSupplierPayment = function (id) {
    const payment = db.supplierPayments.find((p) => p.id === id);
    if (!payment) return;
    if (!confirm("هل أنت متأكد من حذف هذه الدفعة؟")) return;

    db.supplierPayments = db.supplierPayments.filter((p) => p.id !== id);
    updateSupplierBalance(payment.supplierId);
    saveDB(db);
    renderSupplierPayments();
    renderDashboard();
    renderSuppliers();
    showToast("تم حذف الدفعة 🗑️");
  };

  // ============ التقارير ============
  function renderReports() {
    // إحصائيات عامة
    const totalCustomerDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0,
    );
    const totalSupplierDebts = db.suppliers.reduce(
      (s, sup) => s + Math.max(0, sup.balance || 0),
      0,
    );
    const inventoryCostValue = db.inventory.reduce(
      (s, i) => s + i.quantity * i.purchasePrice,
      0,
    );
    const inventorySellValue = db.inventory.reduce(
      (s, i) => s + i.quantity * i.sellingPrice,
      0,
    );
    const lowStockCount = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5),
    ).length;

    document.getElementById("reportStats").innerHTML = `
            <div class="stat-card">
                <div class="stat-icon red">💸</div>
                <div class="stat-info"><h3>ديون العملاء المستحقة</h3><div class="value positive">${formatCurrency(totalCustomerDebts)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">🏦</div>
                <div class="stat-info"><h3>ديون للموردين</h3><div class="value">${formatCurrency(totalSupplierDebts)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">📦</div>
                <div class="stat-info"><h3>قيمة المخزون بسعر الشراء</h3><div class="value">${formatCurrency(inventoryCostValue)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">💰</div>
                <div class="stat-info"><h3>قيمة المخزون بسعر البيع</h3><div class="value">${formatCurrency(inventorySellValue)}</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">⚠️</div>
                <div class="stat-info"><h3>قطع تحتاج إعادة طلب</h3><div class="value">${lowStockCount}</div></div>
            </div>
        `;

    // قيمة المخزون بسعر الشراء
    document.getElementById("inventoryCostValue").innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>📦 إجمالي قيمة البضاعة في المستودع <strong>بسعر الشراء</strong>:</span>
                <span style="font-size:24px; color:var(--primary);">${formatCurrency(inventoryCostValue)}</span>
            </div>
        `;

    // الأرباح الشهرية
    const monthlyProfits = {};

    // تجميع المبيعات حسب الشهر
    db.sales.forEach((s) => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyProfits[key]) {
        monthlyProfits[key] = {
          sales: 0,
          cost: 0,
          count: 0,
          returnsValue: 0,
        };
      }
      monthlyProfits[key].sales += s.total;
      monthlyProfits[key].cost += (s.purchasePriceAtSale || 0) * s.quantity;
      monthlyProfits[key].count++;
    });

    // خصم المرتجعات من الأرباح
    db.salesReturns.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyProfits[key]) {
        monthlyProfits[key] = { sales: 0, cost: 0, count: 0, returnsValue: 0 };
      }
      const sale = db.sales.find((s) => s.id === r.saleId);
      if (sale) {
        monthlyProfits[key].returnsValue += r.quantity * sale.unitPrice;
        monthlyProfits[key].cost -=
          (sale.purchasePriceAtSale || 0) * r.quantity;
      }
    });

    const months = Object.entries(monthlyProfits).sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
    const tbody = document.getElementById("monthlyProfitBody");

    if (months.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5"><div class="empty-state">لا توجد بيانات أرباح شهرية</div></td></tr>';
    } else {
      tbody.innerHTML = months
        .map(([month, data]) => {
          const netSales = data.sales - data.returnsValue;
          const profit = netSales - data.cost;
          const profitClass = profit >= 0 ? "var(--success)" : "var(--danger)";
          return `
                    <tr>
                        <td><strong>${month}</strong></td>
                        <td>${data.count} فاتورة</td>
                        <td>${formatCurrency(netSales)}</td>
                        <td>${formatCurrency(data.cost)}</td>
                        <td><strong style="color:${profitClass}">${formatCurrency(profit)}</strong></td>
                    </tr>`;
        })
        .join("");
    }
  }

  // ============ دوال عامة للنوافذ ============
  window.closeModal = function (overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    document.getElementById("modalContainer").innerHTML = "";
  };

  document
    .getElementById("modalContainer")
    .addEventListener("click", function (e) {
      if (e.target.classList.contains("modal-overlay")) {
        e.target.remove();
      }
    });

  // ============ دوال التصدير والاستيراد ============
  window.exportData = function () {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      showToast("لا توجد بيانات لتصديرها", "error");
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-parts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("تم تصدير البيانات بنجاح ✅");
  };

  window.importData = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const content = e.target.result;
        JSON.parse(content);
        localStorage.setItem(STORAGE_KEY, content);
        showToast("تم استيراد البيانات بنجاح ✅ سيتم إعادة تحميل الصفحة...");
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast("ملف البيانات غير صالح", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // ============ التهيئة الأولية ============
  function seedDemoData() {
    if (db.customers.length === 0) {
      const c1 = {
        id: generateId("customer"),
        name: "أحمد محمد",
        phone: "01001234567",
        address: "القاهرة",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      const c2 = {
        id: generateId("customer"),
        name: "محمود علي",
        phone: "01111234567",
        address: "الجيزة",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      const c3 = {
        id: generateId("customer"),
        name: "سعيد حسين",
        phone: "01221234567",
        address: "الإسكندرية",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      db.customers.push(c1, c2, c3);
    }

    if (db.suppliers.length === 0) {
      const s1 = {
        id: generateId("supplier"),
        name: "شركة النور لقطع الغيار",
        phone: "0222222222",
        address: "القاهرة",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      const s2 = {
        id: generateId("supplier"),
        name: "مستورد السيارات المتحدة",
        phone: "0333333333",
        address: "الإسكندرية",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      db.suppliers.push(s1, s2);
    }

    if (db.inventory.length === 0) {
      const i1 = {
        id: generateId("inventory"),
        partName: "فلتر زيت",
        partNumber: "FO-001",
        category: "فلاتر",
        quantity: 25,
        minAlert: 5,
        purchasePrice: 50,
        sellingPrice: 85,
        supplier: "شركة النور",
        image: "",
        createdAt: new Date().toISOString(),
      };
      const i2 = {
        id: generateId("inventory"),
        partName: "بطارية 70 أمبير",
        partNumber: "BAT-070",
        category: "بطاريات",
        quantity: 8,
        minAlert: 3,
        purchasePrice: 1800,
        sellingPrice: 2200,
        supplier: "مستورد السيارات",
        image: "",
        createdAt: new Date().toISOString(),
      };
      const i3 = {
        id: generateId("inventory"),
        partName: "طقم فرامل أمامي",
        partNumber: "BR-202",
        category: "فرامل",
        quantity: 12,
        minAlert: 4,
        purchasePrice: 650,
        sellingPrice: 950,
        supplier: "شركة النور",
        image: "",
        createdAt: new Date().toISOString(),
      };
      const i4 = {
        id: generateId("inventory"),
        partName: "زيت محرك 5W-30",
        partNumber: "OIL-530",
        category: "زيوت",
        quantity: 3,
        minAlert: 10,
        purchasePrice: 200,
        sellingPrice: 320,
        supplier: "مستورد السيارات",
        image: "",
        createdAt: new Date().toISOString(),
      };
      const i5 = {
        id: generateId("inventory"),
        partName: "شمعات احتراق",
        partNumber: "SP-004",
        category: "كهرباء",
        quantity: 40,
        minAlert: 8,
        purchasePrice: 120,
        sellingPrice: 200,
        supplier: "شركة النور",
        image: "",
        createdAt: new Date().toISOString(),
      };
      const i6 = {
        id: generateId("inventory"),
        partName: "سير توقيت",
        partNumber: "TB-101",
        category: "محرك",
        quantity: 6,
        minAlert: 3,
        purchasePrice: 350,
        sellingPrice: 550,
        supplier: "مستورد السيارات",
        image: "",
        createdAt: new Date().toISOString(),
      };
      db.inventory.push(i1, i2, i3, i4, i5, i6);

      // عملية بيع تجريبية
      const s1 = {
        id: generateId("sale"),
        customerId: c1.id,
        inventoryId: i1.id,
        quantity: 3,
        unitPrice: 85,
        total: 255,
        paid: 100,
        remaining: 155,
        purchasePriceAtSale: 50,
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
      };
      i1.quantity -= 3;
      db.sales.push(s1);

      const s2 = {
        id: generateId("sale"),
        customerId: c2.id,
        inventoryId: i3.id,
        quantity: 1,
        unitPrice: 950,
        total: 950,
        paid: 950,
        remaining: 0,
        purchasePriceAtSale: 650,
        date: new Date(Date.now() - 86400000).toISOString(),
      };
      i3.quantity -= 1;
      db.sales.push(s2);

      // عملية شراء تجريبية
      const p1 = {
        id: generateId("purchase"),
        supplierId: s1.id,
        inventoryId: i2.id,
        quantity: 5,
        unitPrice: 1800,
        total: 9000,
        paid: 5000,
        remaining: 4000,
        date: new Date(Date.now() - 86400000 * 3).toISOString(),
      };
      i2.quantity += 5;
      db.purchases.push(p1);

      updateCustomerBalance(c1.id);
      updateCustomerBalance(c2.id);
      updateSupplierBalance(s1.id);
    }

    saveDB(db);
  }

  function init() {
    // التأكد من وجود جميع المصفوفات
    if (!db.customers) db.customers = [];
    if (!db.suppliers) db.suppliers = [];
    if (!db.inventory) db.inventory = [];
    if (!db.sales) db.sales = [];
    if (!db.purchases) db.purchases = [];
    if (!db.payments) db.payments = [];
    if (!db.supplierPayments) db.supplierPayments = [];
    if (!db.salesReturns) db.salesReturns = [];
    if (!db.purchaseReturns) db.purchaseReturns = [];
    if (!db.nextIds)
      db.nextIds = {
        customer: 1,
        supplier: 1,
        inventory: 1,
        sale: 1,
        purchase: 1,
        payment: 1,
        supplierPayment: 1,
        salesReturn: 1,
        purchaseReturn: 1,
      };

    // تحديث جميع الأرصدة
    db.customers.forEach((c) => updateCustomerBalance(c.id));
    db.suppliers.forEach((s) => updateSupplierBalance(s.id));
    saveDB(db);

    // إضافة بيانات تجريبية إذا كانت فارغة
    if (db.customers.length === 0 && db.inventory.length === 0) {
      seedDemoData();
    }

    renderDashboard();

    console.log("✅ نظام إدارة متجر قطع السيارات جاهز");
    console.log("📊 لوحة التحكم | 👥 العملاء | 🏭 الموردين | 📦 المستودع");
    console.log("💰 المبيعات | 📥 المشتريات | 💳 التسديدات | 📋 التقارير");
  }

  // ============ تعريض الدوال للنطاق العام ============
  window.openCustomerModal = window.openCustomerModal;
  window.editCustomer = window.editCustomer;
  window.saveCustomer = window.saveCustomer;
  window.deleteCustomer = window.deleteCustomer;

  window.openSupplierModal = window.openSupplierModal;
  window.editSupplier = window.editSupplier;
  window.saveSupplier = window.saveSupplier;
  window.deleteSupplier = window.deleteSupplier;

  window.openInventoryModal = window.openInventoryModal;
  window.editInventory = window.editInventory;
  window.saveInventory = window.saveInventory;
  window.deleteInventory = window.deleteInventory;
  window.previewPartImage = window.previewPartImage;

  window.openSaleModal = window.openSaleModal;
  window.updateSalePrice = window.updateSalePrice;
  window.updateSaleTotal = window.updateSaleTotal;
  window.updateSaleRemaining = window.updateSaleRemaining;
  window.saveSale = window.saveSale;
  window.deleteSale = window.deleteSale;
  window.openSalesReturnModal = window.openSalesReturnModal;
  window.saveSalesReturn = window.saveSalesReturn;

  window.openPurchaseModal = window.openPurchaseModal;
  window.updatePurchasePrice = window.updatePurchasePrice;
  window.updatePurchaseTotal = window.updatePurchaseTotal;
  window.updatePurchaseRemaining = window.updatePurchaseRemaining;
  window.savePurchase = window.savePurchase;
  window.deletePurchase = window.deletePurchase;
  window.openPurchaseReturnModal = window.openPurchaseReturnModal;
  window.savePurchaseReturn = window.savePurchaseReturn;

  window.openPaymentModal = window.openPaymentModal;
  window.savePayment = window.savePayment;
  window.deletePayment = window.deletePayment;

  window.openSupplierPaymentModal = window.openSupplierPaymentModal;
  window.saveSupplierPayment = window.saveSupplierPayment;
  window.deleteSupplierPayment = window.deleteSupplierPayment;

  window.closeModal = window.closeModal;
  window.exportData = window.exportData;
  window.importData = window.importData;

  // بدء التطبيق
  init();
})();
