import { useEffect, useMemo, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import {
  CheckCircle2,
  Filter,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type Settings = {
  brand: string;
  tagline: string;
  heroTitle: string;
  heroText: string;
  comboSaleEyebrow: string;
  comboSaleTitle: string;
  comboSaleText: string;
  metaPixelId: string;
  whatsapp: string;
  phone: string;
  address: string;
  logoUrl?: string;
  heroImagePath?: string;
  heroImageUrl?: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  price: number;
  wholesalePrice: number;
  description: string;
  inStock: boolean;
  badge?: string;
  salePrice?: number;
  sizes?: string[];
  colors?: string[];
  image: string;
  images?: string[];
  imagePath?: string;
  imagePaths?: string[];
  originalImagePath?: string;
  originalImagePaths?: string[];
};

type Draft = Omit<Product, 'id' | 'image'>;
type CartItem = { product: Product; qty: number; size?: string };

const defaults: Settings = {
  brand: 'REBORN',
  tagline: 'Wholesale & Retail Fashion',
  heroTitle: 'Style for Everyone',
  heroText: 'Women, Men, Kids, Wigs, Shoes, Perfumes and more — retail and wholesale.',
  comboSaleEyebrow: 'LIMITED PROMO',
  comboSaleTitle: 'Combo Sales',
  comboSaleText: 'Special bundle deals from REBORN. Shop selected combinations at promotional prices while they last.',
  metaPixelId: '',
  whatsapp: '09060759664',
  phone: '07031339024',
  address: 'Warri, Delta State, Nigeria',
};

const blank: Draft = {
  name: '',
  category: 'Women',
  brand: 'REBORN',
  price: 0,
  wholesalePrice: 0,
  description: '',
  inStock: true,
  sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
  colors: [],
  imagePaths: [],
};

const cats = ['All', 'Women', 'Men', 'Unisex', 'Kids', 'Wigs', 'Shoes', 'Perfumes', 'Accessories'];
const menSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const money = (n: number) => '₦' + Number(n || 0).toLocaleString();
const phoneNumber = (v: string) => v.replace(/\D/g, '').replace(/^0/, '234');
const effectivePrice = (p: Product) => (p.salePrice && p.salePrice < p.price ? p.salePrice : p.price);
const collectionSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

function metaTrack(event: string, data?: Record<string, unknown>) {
  const fbq = (window as any).fbq;
  if (typeof fbq === 'function') fbq('track', event, data || {});
}

function initMetaPixel(pixelId: string) {
  const id = String(pixelId || '').trim();
  if (!/^\d{5,30}$/.test(id)) return;
  const w = window as any;
  if (!w.fbq) {
    const fbq: any = function (...args: any[]) { fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args); };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  if (w.__rebornMetaPixelId !== id) {
    w.fbq('init', id);
    w.__rebornMetaPixelId = id;
  }
}

const parseCollectionHash = () => {
  const raw = location.hash.replace(/^#collection\/?/, '');
  if (!raw || location.hash === '#admin') return { category: 'All', subcategory: '' };
  const [catSlug, subSlug] = raw.split('/');
  const category = cats.slice(1).find((c) => collectionSlug(c) === catSlug) || 'All';
  const subcategory = subSlug === 'denim' ? 'Denim' : subSlug === 'baggy-jean' ? 'Baggy Jean' : '';
  return { category, subcategory };
};

const collectionCopy: Record<string, { title: string; text: string }> = {
  Women: { title: "Women's Collection", text: 'Shop stylish women’s fashion for everyday wear, outings and special occasions.' },
  Men: { title: "Men's Collection", text: 'Explore denim, baggy fits, polos and everyday men’s fashion.' },
  Unisex: { title: 'Unisex Collection', text: 'Shop versatile styles designed for everyone, including polos, tees, hoodies and more.' },
  Kids: { title: "Kids' Collection", text: 'Comfortable, stylish fashion and essentials for children.' },
  Wigs: { title: 'Wigs Collection', text: 'Explore beautiful wigs and hair options selected for everyday and occasion looks.' },
  Shoes: { title: 'Shoes Collection', text: 'Shop footwear for everyday style, work, outings and special occasions.' },
  Perfumes: { title: 'Perfumes Collection', text: 'Discover fragrances for personal use, gifting and everyday confidence.' },
  Accessories: { title: 'Accessories Collection', text: 'Complete your look with practical and stylish fashion accessories.' },
};

function App() {
  const [admin, setAdmin] = useState(location.hash === '#admin');
  const [settings, setSettings] = useState(defaults);
  const initialCollection = parseCollectionHash();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState(initialCollection.category);
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menTab, setMenTab] = useState(initialCollection.subcategory || 'All Men');
  const [menBrand, setMenBrand] = useState('All');
  const [menSize, setMenSize] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [newArrivalIndex, setNewArrivalIndex] = useState(0);
  const [comboSaleOnly, setComboSaleOnly] = useState(location.hash === '#promo/combo-sales');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('reborn-cart') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const onHash = () => {
      setAdmin(location.hash === '#admin');
      setComboSaleOnly(location.hash === '#promo/combo-sales');
      if (location.hash !== '#admin' && location.hash !== '#promo/combo-sales') {
        const next = parseCollectionHash();
        setCategory(next.category);
        if (next.category === 'Men') setMenTab(next.subcategory || 'All Men');
      }
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (admin) return;
    const copy = collectionCopy[category];
    document.title = copy ? `${copy.title} | REBORN Collections` : 'REBORN Fashion | Women, Men, Kids, Wigs, Shoes & Perfumes';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', copy ? `${copy.text} Wholesale and retail shopping from REBORN Collections.` : 'Shop REBORN for women, men and kids fashion, wigs, shoes and perfumes. Wholesale and retail orders with WhatsApp availability confirmation.');
  }, [category, admin]);

  useEffect(() => {
    localStorage.setItem('reborn-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!admin && settings.metaPixelId) initMetaPixel(settings.metaPixelId);
  }, [admin, settings.metaPixelId]);

  useEffect(() => {
    if (admin || !settings.metaPixelId) return;
    metaTrack('PageView');
    if (comboSaleOnly) {
      metaTrack('ViewContent', { content_name: settings.comboSaleTitle, content_category: 'Combo Sales', content_type: 'product_group' });
    } else if (category !== 'All') {
      metaTrack('ViewContent', { content_name: category + ' Collection', content_category: category, content_type: 'product_group' });
    }
  }, [admin, category, comboSaleOnly, settings.metaPixelId, settings.comboSaleTitle]);

  const newArrivals = products.filter((p) => p.badge === 'New Arrival' && (category === 'All' || p.category === category));
  const comboSales = products.filter((p) => p.badge === 'Combo Sale');

  useEffect(() => {
    setNewArrivalIndex(0);
    if (newArrivals.length <= 1) return;
    const timer = setInterval(() => setNewArrivalIndex((current) => (current + 1) % newArrivals.length), 4500);
    return () => clearInterval(timer);
  }, [category, products.length, newArrivals.length]);

  async function load() {
    try {
      const r = await api.get('/api/site');
      setSettings({ ...defaults, ...(r.data?.settings || {}) });
      setProducts(Array.isArray(r.data?.products) ? r.data.products : []);
      setLoadError(false);
    } catch (err) {
      console.error('Unable to load the REBORN product catalogue:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (admin) return;
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [admin]);

  const menProducts = products.filter((p) => p.category === 'Men');
  const menBrands = Array.from(new Set(menProducts.map((p) => p.brand || 'REBORN'))).sort();
  const list = useMemo(() => {
    if (comboSaleOnly) return products.filter((p) => p.badge === 'Combo Sale');
    if (category !== 'Men') return category === 'All' ? products : products.filter((p) => p.category === category);
    return menProducts.filter(
      (p) =>
        (menTab === 'All Men' || p.subcategory === menTab) &&
        (menBrand === 'All' || (p.brand || 'REBORN') === menBrand) &&
        (menSize === 'All' || (p.sizes || []).includes(menSize)),
    );
  }, [products, category, menTab, menBrand, menSize, comboSaleOnly]);

  if (admin) return <Admin />;

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + effectivePrice(item.product) * item.qty, 0);

  function openProduct(p: Product) {
    metaTrack('ViewContent', { content_ids: [p.id], content_name: p.name, content_category: p.category, content_type: 'product', value: effectivePrice(p), currency: 'NGN' });
    setSelected(p);
    setSelectedSize(p.sizes?.[0] || '');
  }

  function addToCart(p: Product, size?: string) {
    metaTrack('AddToCart', { content_ids: [p.id], content_name: p.name, content_category: p.category, content_type: 'product', value: effectivePrice(p), currency: 'NGN' });
    setCart((current) => {
      const index = current.findIndex((item) => item.product.id === p.id && (item.size || '') === (size || ''));
      if (index >= 0) {
        return current.map((item, i) => (i === index ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...current, { product: p, qty: 1, size }];
    });
    setSelected(null);
    setCartOpen(true);
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) setCart((c) => c.filter((_, i) => i !== index));
    else setCart((c) => c.map((item, i) => (i === index ? { ...item, qty } : item)));
  }

  function cartSummary(prefix: string) {
    const lines = cart.map(
      (item, i) =>
        `${i + 1}. ${item.product.name}${item.size ? ' - Size ' + item.size : ''} x${item.qty} — ${money(
          effectivePrice(item.product) * item.qty,
        )}`,
    );
    return [prefix, '', ...lines, '', 'Total: ' + money(cartTotal)].join('\n');
  }

  function paymentInstructions(total: number) {
    return [
      '',
      'PAYMENT DETAILS',
      'Account name: Reborn Classica collection',
      'Bank: Moniepoint',
      'Account number: 5107360858',
      'Amount to transfer: ' + money(total),
      '',
      'Please transfer the exact amount and send your payment receipt in this WhatsApp chat together with your name, phone number and delivery address.',
    ].join('\n');
  }

  function whatsappCheckout() {
    if (!cart.length) return;
    metaTrack('InitiateCheckout', { content_ids: cart.map((item) => item.product.id), content_type: 'product', value: cartTotal, currency: 'NGN', num_items: cart.reduce((sum, item) => sum + item.qty, 0) });
    const reference = 'RBW-' + Date.now().toString(36).toUpperCase();
    const text = cartSummary('Hello REBORN, I want to checkout these items:') + '\n\nOrder reference: ' + reference + paymentInstructions(cartTotal);
    window.open('https://wa.me/' + phoneNumber(settings.whatsapp) + '?text=' + encodeURIComponent(text), '_blank');
  }

  function singleWhatsAppCheckout(p: Product, size?: string) {
    const total = effectivePrice(p);
    metaTrack('InitiateCheckout', { content_ids: [p.id], content_name: p.name, content_category: p.category, content_type: 'product', value: total, currency: 'NGN', num_items: 1 });
    const reference = 'RBW-' + Date.now().toString(36).toUpperCase();
    const text = [
      'Hello REBORN, I want to buy this item:',
      '',
      p.name + (size ? ' - Size ' + size : ''),
      'Price: ' + money(total),
      'Order reference: ' + reference,
      paymentInstructions(total),
    ].join('\n');
    window.open('https://wa.me/' + phoneNumber(settings.whatsapp) + '?text=' + encodeURIComponent(text), '_blank');
  }

  return (
    <div className='site'>
      <header>
        <nav>
          <a href='#top' className='brand'>
            {settings.logoUrl ? <img src={settings.logoUrl} alt='REBORN logo' /> : settings.brand}
          </a>
          <div className={'nav ' + (menu ? 'open' : '')}>
            {cats.slice(1).map((c) => (
              <button key={c} onClick={() => { location.hash = '#collection/' + collectionSlug(c); setCategory(c); setMenu(false); }}>
                {c}
              </button>
            ))}
          </div>
          <div className='navActions'>
            <button className='cartButton' onClick={() => setCartOpen(true)}>
              <ShoppingCart size={19} /> Cart {cartCount > 0 && <span>{cartCount}</span>}
            </button>
            <button className='menu' aria-label={menu ? 'Close collection menu' : 'Open collection menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
          </div>
        </nav>
        <section className='hero'>
          <div>
            <small>{category === 'All' ? 'WHOLESALE & RETAIL' : 'REBORN COLLECTION'}</small>
            <h1>{category === 'All' ? settings.heroTitle : collectionCopy[category]?.title || category + ' Collection'}</h1>
            <p>{category === 'All' ? settings.heroText : collectionCopy[category]?.text}</p>
            <div className='heroCtas'>
              <a href='#shop'>{category === 'All' ? 'Explore collections' : 'Shop ' + category}</a>
              <a className='heroSecondary' href={'https://wa.me/' + phoneNumber(settings.whatsapp) + '?text=' + encodeURIComponent('Hello REBORN, I would like help shopping your collections.')} target='_blank' rel='noopener noreferrer'><MessageCircle size={18} /> Chat to order</a>
            </div>
          </div>
          {settings.heroImageUrl ? (
            <div className='heroVisual'>
              <div className='heroArch'></div>
              <img src={settings.heroImageUrl} alt='REBORN fashion model' />
            </div>
          ) : (
            <div className='heroBox'><ShoppingBag /><b>REBORN Collections</b><span>{settings.address}</span></div>
          )}
        </section>
      </header>

      <main id='shop'>
        {comboSales.length > 0 && !comboSaleOnly && (
          <section className='newArrivalShowcase' aria-label='Combo sales promotion'>
            <div className='newArrivalTop'>
              <div><small>{settings.comboSaleEyebrow}</small><h2>{settings.comboSaleTitle}</h2><p>{settings.comboSaleText}</p></div>
              <div className='newArrivalActions'><button onClick={() => { location.hash = '#promo/combo-sales'; setComboSaleOnly(true); }}>Shop Combo Sales</button></div>
            </div>
            <div className='grid'>{comboSales.slice(0, 4).map((p) => <article key={p.id}><button className='photo' onClick={() => openProduct(p)}><img src={p.image} alt={p.name} /><span>COMBO SALE</span></button><div className='info'><small>{p.category}</small><h3>{p.name}</h3><div><b>{money(effectivePrice(p))}</b><em>Promo bundle</em></div><div className='cardActions'><button onClick={() => openProduct(p)}>View</button><button onClick={() => addToCart(p, p.sizes?.[0])}><ShoppingCart size={15} /> Add</button></div></div></article>)}</div>
          </section>
        )}
        {newArrivals.length > 0 && !comboSaleOnly && (
          <section className='newArrivalShowcase' aria-label='New arrivals slideshow'>
            <div className='newArrivalTop'>
              <div><small>JUST DROPPED</small><h2>New Arrival Alert</h2><p>Fresh styles just landed at REBORN. Tap any slide to see the product or shop its collection.</p></div>
              <div className='newArrivalControls'>
                <button aria-label='Previous new arrival' onClick={() => setNewArrivalIndex((newArrivalIndex - 1 + newArrivals.length) % newArrivals.length)}>‹</button>
                <button aria-label='Next new arrival' onClick={() => setNewArrivalIndex((newArrivalIndex + 1) % newArrivals.length)}>›</button>
              </div>
            </div>
            {(() => {
              const item = newArrivals[newArrivalIndex % newArrivals.length];
              return (
                <div className='newArrivalSlide'>
                  <button className='newArrivalImage' onClick={() => openProduct(item)}><img src={item.image} alt={item.name} /><span>NEW ARRIVAL</span></button>
                  <div className='newArrivalCopy'>
                    <small>{item.brand || 'REBORN'} · {item.category}</small>
                    <h3>{item.name}</h3>
                    <strong>{money(effectivePrice(item))}</strong>
                    <p>{item.description || 'A fresh REBORN arrival ready to shop now.'}</p>
                    <div className='newArrivalActions'>
                      <button onClick={() => openProduct(item)}>View product</button>
                      <button onClick={() => { location.hash = '#collection/' + collectionSlug(item.category); setCategory(item.category); }}>Shop {item.category}</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {newArrivals.length > 1 && <div className='newArrivalDots'>{newArrivals.map((item, i) => <button key={item.id} aria-label={'Show new arrival ' + (i + 1)} className={i === newArrivalIndex ? 'active' : ''} onClick={() => setNewArrivalIndex(i)} />)}</div>}
          </section>
        )}
        {loadError && <div role='alert' className='catalogueError'>The catalogue could not be updated. Please try again or message us on WhatsApp for availability. <button onClick={() => void load()}>Retry</button></div>}
        <div className='shopHead'>
          <div>
            <small>LIVE FROM ADMIN</small>
            <h2>{comboSaleOnly ? settings.comboSaleTitle : category === 'All' ? 'Current products' : collectionCopy[category]?.title || category + ' Collection'}</h2>
            <p>{comboSaleOnly ? settings.comboSaleText : category === 'All' ? 'Everything shown here is loaded from the backend database.' : collectionCopy[category]?.text}</p>
          </div>
          <button onClick={load}><RefreshCw size={17} /> Refresh</button>
        </div>
        <div className='chips'>
          {comboSaleOnly && <button className='active'>Combo Sales</button>}
          {cats.map((c) => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => { if (c === 'All') location.hash = ''; else location.hash = '#collection/' + collectionSlug(c); setCategory(c); }}>{c}</button>
          ))}
        </div>

        {category === 'Men' && (
          <>
            <section className='menBanner'>
              <div>
                <small>REBORN MEN</small>
                <h2>Premium Men's Jeans & Streetwear</h2>
                <p>Denim, baggy fits and everyday trousers — retail and wholesale.</p>
                <div className='menTabs'>
                  {['All Men', 'Denim', 'Baggy Jean'].map((tab) => (
                    <button key={tab} className={menTab === tab ? 'active' : ''} onClick={() => { setMenTab(tab); location.hash = tab === 'All Men' ? '#collection/men' : '#collection/men/' + collectionSlug(tab); }}>{tab}</button>
                  ))}
                </div>
              </div>
              <div className='denimArt'><span>R</span><b>DENIM</b></div>
            </section>
            <button className='mobileFilter' onClick={() => setShowFilters(!showFilters)}>
              <Filter size={17} /> Filter by brand & size
            </button>
            <div className='menShop'>
              <aside className={showFilters ? 'show' : ''}>
                <div className='filterBlock'>
                  <b>BRAND</b>
                  <label><input type='radio' name='brand' checked={menBrand === 'All'} onChange={() => setMenBrand('All')} /> All brands</label>
                  {menBrands.map((b) => (
                    <label key={b}><input type='radio' name='brand' checked={menBrand === b} onChange={() => setMenBrand(b)} /> {b}</label>
                  ))}
                </div>
                <div className='filterBlock'>
                  <b>SIZE</b>
                  <label><input type='radio' name='size' checked={menSize === 'All'} onChange={() => setMenSize('All')} /> All sizes</label>
                  {menSizes.map((s) => (
                    <label key={s}><input type='radio' name='size' checked={menSize === s} onChange={() => setMenSize(s)} /> {s}</label>
                  ))}
                </div>
              </aside>
              <ProductGrid list={list} loading={loading} open={openProduct} add={addToCart} />
            </div>
          </>
        )}
        {category !== 'Men' && <ProductGrid list={list} loading={loading} open={openProduct} add={addToCart} />}
      </main>

      <footer><b>{settings.brand}</b><span>{settings.tagline}</span><a onClick={() => metaTrack('Contact', { content_name: 'Footer WhatsApp' })} href={'https://wa.me/' + phoneNumber(settings.whatsapp)}>WhatsApp</a></footer>
      <a className='float' onClick={() => metaTrack('Contact', { content_name: 'Floating WhatsApp chat' })} href={'https://wa.me/' + phoneNumber(settings.whatsapp)}><MessageCircle /> Chat</a>

      {selected && (
        <div className='modal' onClick={() => setSelected(null)}>
          <div className='productModal' onClick={(e) => e.stopPropagation()}>
            <button className='close' onClick={() => setSelected(null)}><X /></button>
            <div className='gallery'>
              <img src={selected.image} alt={selected.name} />
              {selected.images && selected.images.length > 1 && (
                <div>{selected.images.map((img, n) => <img key={img + n} src={img} alt={selected.name + ' ' + (n + 1)} />)}</div>
              )}
            </div>
            <div className='detail'>
              <small>{selected.brand || 'REBORN'} · {selected.category}</small>
              <h2>{selected.name}</h2>
              <h3>{money(effectivePrice(selected))}</h3>
              <p>{selected.description}</p>
              {!!selected.sizes?.length && (
                <label className='sizeSelect'>Size
                  <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                    {selected.sizes.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              )}
              <div className='productActions'>
                <button className='addCart' onClick={() => addToCart(selected, selectedSize || undefined)}><ShoppingCart size={18} /> Add to cart</button>
                <button className='whatsappButton' onClick={() => singleWhatsAppCheckout(selected, selectedSize || undefined)}><MessageCircle size={18} /> Buy on WhatsApp</button>
                <a onClick={() => metaTrack('Contact', { content_ids: [selected.id], content_name: selected.name, content_category: selected.category })} href={'https://wa.me/' + phoneNumber(settings.whatsapp) + '?text=' + encodeURIComponent('Hello REBORN, is ' + selected.name + (selectedSize ? ' in size ' + selectedSize : '') + ' available?')}>
                  <MessageCircle size={18} /> Check availability
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className='cartDrawer'>
          <div className='cartPanel'>
            <div className='cartHead'><h2>Your cart</h2><button onClick={() => setCartOpen(false)}><X /></button></div>
            {!cart.length ? (
              <div className='empty'><ShoppingCart /><b>Your cart is empty</b></div>
            ) : (
              <>
                <div className='cartLines'>
                  {cart.map((item, index) => (
                    <div className='cartLine' key={item.product.id + (item.size || '')}>
                      <img src={item.product.image} alt={item.product.name} />
                      <div><b>{item.product.name}</b>{item.size && <small>Size: {item.size}</small>}<span>{money(effectivePrice(item.product))}</span></div>
                      <div className='qty'>
                        <button onClick={() => updateQty(index, item.qty - 1)}><Minus size={14} /></button>
                        <b>{item.qty}</b>
                        <button onClick={() => updateQty(index, item.qty + 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className='cartTotal'><span>Total</span><b>{money(cartTotal)}</b></div>
                <div className='cartCheckoutButtons'>
                  <button className='whatsappButton' onClick={whatsappCheckout}><MessageCircle size={18} /> Checkout & Pay on WhatsApp</button>
                  <p className='hint'>Your order summary, total and Moniepoint transfer details will open in WhatsApp DM. Send your receipt there after payment.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductGrid({
  list,
  loading,
  open,
  add,
}: {
  list: Product[];
  loading: boolean;
  open: (p: Product) => void;
  add: (p: Product, size?: string) => void;
}) {
  if (loading) return <div className='empty'>Loading…</div>;
  if (!list.length) return <div className='empty'><Package /><b>No products match these filters</b><p>Try another brand, size or collection.</p></div>;
  return (
    <div className='grid'>
      {list.map((p) => (
        <article key={p.id}>
          <button className='photo' onClick={() => open(p)}><img src={p.image} alt={p.name} />{p.badge && <span>{p.badge}</span>}</button>
          <div className='info'>
            <small>{p.brand || 'REBORN'} · {p.category}{p.subcategory ? ' · ' + p.subcategory : ''}</small>
            <h3>{p.name}</h3>
            <div><b>{money(effectivePrice(p))}</b><em>Wholesale {money(p.wholesalePrice)}</em></div>
            <div className='sizeLine'>{(p.sizes || []).slice(0, 6).map((s) => <span key={s}>{s}</span>)}</div>
            <div className='cardActions'>
              <button onClick={() => open(p)}>View</button>
              <button onClick={() => add(p, p.sizes?.[0])}><ShoppingCart size={15} /> Add</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Admin() {
  const [signed, setSigned] = useState(auth.isSignedIn());
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'gallery' | 'batch'>('gallery');

  async function load() {
    try {
      let r;
      try {
        r = await api.get('/api/admin/data');
      } catch {
        await api.post('/api/admin/claim');
        r = await api.get('/api/admin/data');
      }
      setSettings({ ...defaults, ...r.data.settings });
      setProducts(r.data.products || []);
      setReady(true);
      const test = await api.get('/api/admin/connection-test');
      if (test.data?.ok) setMessage('✓ Admin, backend and storefront are connected.');
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Could not connect to backend.');
    }
  }

  useEffect(() => { if (signed) load(); }, [signed]);

  async function login() {
    try {
      await auth.signIn({ scope: 'openid email profile offline_access' });
      setSigned(true);
    } catch (e: any) {
      setMessage(e?.code === 'popup_blocked' ? 'Allow pop-ups and try again.' : 'Sign in was not completed.');
    }
  }

  async function saveSettings() {
    try {
      const r = await api.put('/api/admin/settings', settings);
      setSettings({ ...defaults, ...r.data.settings });
      setProducts(r.data.products || []);
      setMessage('✓ Website settings saved. Frontend is now using the new values.');
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Could not save settings.');
    }
  }

  async function uploadHero(file: File | null) {
    if (!file) return;
    setHeroUploading(true);
    setMessage('Uploading hero fashion model…');
    try {
      const body = await encode(file);
      const up = await api.post('/api/admin/upload-image', body);
      if (!up.data?.imagePath) throw new Error('Hero image upload did not return a path.');
      const r = await api.put('/api/admin/settings', { ...settings, heroImagePath: up.data.imagePath });
      setSettings({ ...defaults, ...r.data.settings });
      setProducts(r.data.products || []);
      setMessage('✓ Hero fashion model uploaded and published to the website.');
    } catch (e: any) {
      setMessage('Hero upload failed: ' + (e?.response?.data?.error || e?.message || 'Unknown error'));
    } finally {
      setHeroUploading(false);
    }
  }

  function choose(list: FileList | null) {
    previews.forEach(URL.revokeObjectURL);
    const limit = uploadMode === 'batch' ? 50 : 15;
    const allPicked = Array.from(list || []);
    const picked = allPicked.slice(0, limit);
    setFiles(picked);
    setPreviews(picked.map(URL.createObjectURL));
    if (!picked.length) {
      setMessage('No photos selected.');
    } else if (allPicked.length > limit) {
      setMessage(`✓ ${picked.length} photo(s) selected. ${allPicked.length - limit} extra file(s) were not added because the ${uploadMode === 'batch' ? 'batch' : 'gallery'} limit is ${limit}.`);
    } else {
      setMessage(`✓ ${picked.length} photo(s) selected.`);
    }
  }

  async function encode(file: File) {
    if (file.size > 25 * 1024 * 1024) throw new Error(file.name + ' is too large.');
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((ok, no) => {
      img.onload = () => ok();
      img.onerror = () => no(new Error(file.name + ' cannot be opened by this browser.'));
      img.src = url;
    });
    const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing unavailable.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob>((ok, no) =>
      canvas.toBlob((b) => (b ? ok(b) : no(new Error('Could not prepare image.'))), 'image/jpeg', 0.58),
    );
    return new Promise<{ data: string; contentType: string; fileName: string }>((ok, no) => {
      const reader = new FileReader();
      reader.onload = () => ok({ data: String(reader.result || '').split(',')[1] || '', contentType: 'image/jpeg', fileName: file.name });
      reader.onerror = () => no(new Error('Could not read ' + file.name));
      reader.readAsDataURL(blob);
    });
  }

  async function publish() {
    if (publishing) return;
    setPublishMessage('Checking product details…');
    if (!draft.name.trim()) return setPublishMessage('Please enter the product name before publishing.');
    if (draft.price <= 0) return setPublishMessage('Please enter a valid retail price before publishing.');
    if (!files.length) return setPublishMessage('Please choose at least one product photo before publishing.');

    setPublishing(true);
    try {
      if (uploadMode === 'batch') {
        const skipped: string[] = [];
        let publishedCount = 0;
        for (let i = 0; i < files.length; i++) {
          setPublishMessage(`Publishing product ${i + 1} of ${files.length}…`);
          try {
            const body = await encode(files[i]);
            const up = await api.post('/api/admin/upload-image', body);
            if (!up.data?.imagePath) throw new Error('Backend did not return an image path.');
            const itemName = files.length > 1 ? draft.name + ' ' + (i + 1) : draft.name;
            await api.post('/api/admin/products', {
              ...draft,
              name: itemName,
              imagePath: up.data.imagePath,
              imagePaths: [up.data.imagePath],
            });
            publishedCount += 1;
          } catch (fileError: any) {
            skipped.push(files[i].name + ': ' + (fileError?.response?.data?.error || fileError?.message || 'could not be processed'));
          }
        }
        if (!publishedCount) throw new Error('None of the selected images could be processed. Please re-save the photos as JPG or PNG and try again.');
        const refreshed = await api.get('/api/admin/data');
        setProducts(refreshed.data.products || []);
        setSettings({ ...defaults, ...refreshed.data.settings });
        const skippedText = skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 5).join(' | ')}${skipped.length > 5 ? ' | +' + (skipped.length - 5) + ' more' : ''}.` : '';
        setPublishMessage(`✓ ${publishedCount} of ${files.length} products published.${skippedText}`);
      } else {
        const paths: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setPublishMessage(`Uploading photo ${i + 1} of ${files.length}…`);
          const body = await encode(files[i]);
          const up = await api.post('/api/admin/upload-image', body);
          if (!up.data?.imagePath) throw new Error('Backend did not return an image path.');
          paths.push(up.data.imagePath);
        }
        const r = await api.post('/api/admin/products', { ...draft, imagePath: paths[0], imagePaths: paths });
        setProducts(r.data.products || []);
        setSettings({ ...defaults, ...r.data.settings });
        setPublishMessage('✓ Product gallery published successfully.');
      }
      setDraft(blank);
      setFiles([]);
      previews.forEach(URL.revokeObjectURL);
      setPreviews([]);
      setMessage('✓ Product changes are live on the main website.');
    } catch (e: any) {
      const text = 'Publish failed: ' + (e?.response?.data?.error || e?.message || 'Unknown backend error');
      setPublishMessage(text);
      setMessage(text);
    } finally {
      setPublishing(false);
    }
  }

  async function saveProduct(p: Product) {
    try {
      const r = await api.put('/api/admin/products/' + p.id, p);
      setProducts(r.data.products || []);
      setMessage('✓ Product changes saved and published to frontend.');
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Could not update product.');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this product?')) return;
    try {
      const r = await api.delete('/api/admin/products/' + id);
      setProducts(r.data.products || []);
      setMessage('Product deleted from frontend.');
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Could not delete product.');
    }
  }

  if (!signed) {
    return <div className='login'><div><b>REBORN ADMIN</b><h1>Website Control Centre</h1><p>Sign in with the authorized admin account.</p><button onClick={login}><LogIn /> Sign in</button>{message && <p>{message}</p>}</div></div>;
  }

  return (
    <div className='admin'>
      <aside>
        <b>REBORN</b>
        <a href='#top'>View Website</a>
        <button onClick={async () => { await auth.signOut(); setSigned(false); }}><LogOut size={17} /> Sign out</button>
      </aside>
      <main>
        <header>
          <div><small>ADMIN CONTROL CENTRE</small><h1>Manage REBORN</h1></div>
          <div className='connected'><CheckCircle2 /> Backend connected</div>
        </header>
        {message && <div className='notice'>{message}</div>}
        {!ready ? <div className='card'>Connecting to backend…</div> : (
          <>
            <section className='card'>
              <h2>Website settings</h2>
              <div className='form two'>
                <label>Brand<input value={settings.brand} onChange={(e) => setSettings({ ...settings, brand: e.target.value })} /></label>
                <label>Tagline<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
                <label>Hero title<input value={settings.heroTitle} onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })} /></label>
                <label>WhatsApp<input value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label>
                <label className='wide'>Hero text<textarea value={settings.heroText} onChange={(e) => setSettings({ ...settings, heroText: e.target.value })} /></label>
                <div className='wide upload'>
                  <b>Meta / Facebook & Instagram ads tracking</b>
                  <p className='hint'>Paste your Meta Pixel ID here. Once saved, REBORN will track page views, collection and product views, Add to Cart, WhatsApp checkout starts and WhatsApp contact clicks for Meta ads. Leave blank to disable tracking.</p>
                  <label>Meta Pixel ID<input inputMode='numeric' placeholder='e.g. 123456789012345' value={settings.metaPixelId} onChange={(e) => setSettings({ ...settings, metaPixelId: e.target.value.replace(/\D/g, '') })} /></label>
                </div>
                <div className='wide upload'>
                  <b>Combo Sales header</b>
                  <p className='hint'>Change the campaign header anytime before running a new Combo Sales advert.</p>
                  <div className='form two'>
                    <label>Small heading<input value={settings.comboSaleEyebrow} onChange={(e) => setSettings({ ...settings, comboSaleEyebrow: e.target.value })} placeholder='e.g. WEEKEND DEAL' /></label>
                    <label>Main heading<input value={settings.comboSaleTitle} onChange={(e) => setSettings({ ...settings, comboSaleTitle: e.target.value })} placeholder='e.g. Buy 2, Save More' /></label>
                    <label className='wide'>Promo description<textarea value={settings.comboSaleText} onChange={(e) => setSettings({ ...settings, comboSaleText: e.target.value })} placeholder='Describe this combo campaign...' /></label>
                  </div>
                </div>
                <label>Phone<input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label>
                <label>Address<input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
                <div className='upload wide'>
                  <b>Hero fashion model image</b>
                  <p className='hint'>Upload one portrait fashion photo for the right side of the homepage hero.</p>
                  {settings.heroImageUrl && <img className='heroAdminPreview' src={settings.heroImageUrl} alt='Current hero fashion model' />}
                  <input type='file' accept='image/*' disabled={heroUploading} onChange={(e) => void uploadHero(e.currentTarget.files?.[0] || null)} />
                  {heroUploading && <p>Uploading and publishing hero image…</p>}
                </div>
              </div>
              <button className='primary' onClick={saveSettings}><Save size={17} /> Save & Publish Settings</button>
            </section>

            <section className='card'>
              <h2>Add product</h2>
              <p className='hint'>Choose whether your photos are one product gallery or separate products that share the same category and price. <b>New Arrival</b> products appear in the New Arrival slideshow, while <b>Combo Sale</b> products automatically appear in the Combo Sales promo section and its ad landing page.</p>
              <div className='uploadMode'>
                <label><input type='radio' checked={uploadMode === 'gallery'} onChange={() => setUploadMode('gallery')} /> One product with multiple gallery photos</label>
                <label><input type='radio' checked={uploadMode === 'batch'} onChange={() => setUploadMode('batch')} /> Multiple products — same category and price</label>
              </div>
              <div className='form two'>
                <label>Product name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                <label>Collection<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, subcategory: e.target.value === 'Men' ? draft.subcategory : undefined })}>{cats.slice(1).map((c) => <option key={c}>{c}</option>)}</select></label>
                <label>Product brand<input placeholder='e.g. REBORN, Urban Denim' value={draft.brand || ''} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /></label>
                {draft.category === 'Men' && <label>Men subsection<select value={draft.subcategory || ''} onChange={(e) => setDraft({ ...draft, subcategory: e.target.value || undefined })}><option value=''>General Men</option><option>Denim</option><option>Baggy Jean</option></select></label>}
                <label>Retail price<input type='number' inputMode='numeric' value={draft.price || ''} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label>
                <label>Wholesale price<input type='number' inputMode='numeric' value={draft.wholesalePrice || ''} onChange={(e) => setDraft({ ...draft, wholesalePrice: Number(e.target.value) })} /></label>
                <div className='upload wide'>
                  <b>{uploadMode === 'batch' ? 'Product photos — each photo becomes a separate product' : 'Product gallery photos'}</b>
                  <input type='file' accept='image/*' multiple disabled={publishing} onChange={(e) => choose(e.currentTarget.files)} />
                  {previews.length > 0 && <><p>{files.length} selected — ready to publish.</p><div className='previews'>{previews.map((p, i) => <div key={p + i}><img src={p} alt={'preview ' + (i + 1)} onError={(e) => { e.currentTarget.style.display = 'none'; }} /><small>{files[i]?.name}</small></div>)}</div></>}
                </div>
                <label>Sizes<input value={(draft.sizes || []).join(', ')} onChange={(e) => setDraft({ ...draft, sizes: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>
                <label>Promo<select value={draft.badge || ''} onChange={(e) => setDraft({ ...draft, badge: e.target.value || undefined })}><option value=''>None</option><option>New Arrival</option><option>Combo Sale</option><option>Sale</option><option>Best Seller</option><option>Featured</option></select></label>
                <label>Sale price<input type='number' value={draft.salePrice || ''} onChange={(e) => setDraft({ ...draft, salePrice: Number(e.target.value) || undefined })} /></label>
                <label className='wide'>Description<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              </div>
              <button type='button' className='primary publish' aria-busy={publishing} onClick={() => void publish()}>
                {publishing ? <><Upload size={18} /> Publishing…</> : <><Plus size={18} /> {uploadMode === 'batch' ? 'Publish All Products' : 'Publish Product to Website'}</>}
              </button>
              {publishMessage && <div className={'publishStatus ' + (publishMessage.startsWith('✓') ? 'success' : '')}>{publishMessage}</div>}
            </section>

            <section className='card'>
              <div className='sectionTitle'><div><h2>Published products</h2><p>{products.length} product(s) in the backend database.</p></div><button onClick={load}><RefreshCw size={17} /> Sync</button></div>
              <div className='adminProducts'>
                {products.map((p) => (
                  <article key={p.id}>
                    <img src={p.image} alt={p.name} />
                    <div className='edit'>
                      <input value={p.name} onChange={(e) => setProducts((a) => a.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} />
                      <input placeholder='Brand' value={p.brand || 'REBORN'} onChange={(e) => setProducts((a) => a.map((x) => x.id === p.id ? { ...x, brand: e.target.value } : x))} />
                      <select value={p.category} onChange={(e) => setProducts((a) => a.map((x) => x.id === p.id ? { ...x, category: e.target.value } : x))}>{cats.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
                      <input type='number' value={p.price} onChange={(e) => setProducts((a) => a.map((x) => x.id === p.id ? { ...x, price: Number(e.target.value) } : x))} />
                      <textarea value={p.description} onChange={(e) => setProducts((a) => a.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x))} />
                      <div><button onClick={() => saveProduct(p)}><Save size={16} /> Save & Publish</button><button className='danger' onClick={() => remove(p.id)}><Trash2 size={16} /> Delete</button></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
