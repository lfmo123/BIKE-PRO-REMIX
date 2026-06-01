import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, ShoppingCart, DollarSign, PackagePlus, Edit2, Trash2, X } from 'lucide-react';
import { Product, Sale } from '../types';
import { SaleModal } from './SaleModal';

interface StoreProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddSale: (sale: Sale) => void;
}

export function Store({ products, onAddProduct, onUpdateProduct, onDeleteProduct, onAddSale }: StoreProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      id: editingProduct ? editingProduct.id : '',
      name,
      price: parseFloat(price),
      stock: parseInt(stock, 10)
    };

    if (editingProduct) {
      onUpdateProduct(productData);
    } else {
      onAddProduct(productData);
    }

    setIsAddMode(false);
    setEditingProduct(null);
    clearForm();
  };

  const clearForm = () => {
    setName('');
    setPrice('');
    setStock('');
  };

  const startEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setPrice(p.price.toString());
    setStock(p.stock.toString());
    setIsAddMode(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Loja</h2>
          <p className="text-sm text-slate-500">Gerencie produtos e vendas</p>
        </div>
        {!isAddMode && !saleProduct && (
          <button
            onClick={() => { clearForm(); setIsAddMode(true); }}
            className="flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Produto
          </button>
        )}
      </div>

      {(isAddMode || editingProduct) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center">
              <PackagePlus className="w-6 h-6 mr-2 text-emerald-500" />
              {editingProduct ? 'Editar Produto' : 'Adicionar Produto'}
            </h3>
            <button onClick={() => { setIsAddMode(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSaveProduct} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="sm:col-span-3 flex justify-end space-x-3 mt-2">
              <button
                type="button"
                onClick={() => { setIsAddMode(false); setEditingProduct(null); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-medium"
              >
                Salvar Produto
              </button>
            </div>
          </form>
        </div>
      )}

      {saleProduct && (
        <SaleModal
          product={saleProduct}
          onClose={() => setSaleProduct(null)}
          onConfirm={(qty, paymentMethod) => {
            const newSale: Sale = {
              id: '',
              productId: saleProduct.id,
              productName: saleProduct.name,
              quantity: qty,
              totalPrice: qty * saleProduct.price,
              date: Date.now(),
              paymentMethod
            };
            onAddSale(newSale);
            setSaleProduct(null);
          }}
        />
      )}

      {/* Product List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>
        
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4 rounded-tl-2xl">Produto</th>
                  <th className="p-4 hidden sm:table-cell">Preço</th>
                  <th className="p-4 text-center">Estoque</th>
                  <th className="p-4 text-right rounded-tr-2xl">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      {product.name}
                      <div className="sm:hidden text-emerald-600 text-sm mt-1">
                        R$ {product.price.toFixed(2)}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-emerald-600 font-medium">
                      R$ {product.price.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        product.stock > 10 ? 'bg-emerald-100 text-emerald-700' :
                        product.stock > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSaleProduct(product)}
                          disabled={product.stock === 0}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                          title="Vender"
                        >
                          <ShoppingCart className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => startEdit(product)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir este produto?')) {
                              onDeleteProduct(product.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
