import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearch } from '@/contexts/SearchContext';
import { Pagination } from '@/components/common/Pagination';
import api, { Category } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const { query: globalQuery } = useSearch(); // Use global search
  const { user } = useAuth();

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
  }, [page, limit]); // Add page and limit to dependency array

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.getCategories({
        search: globalQuery,
        page,
        limit
      }); // Pass search param and pagination
      if (res.success) {
        setCategories(res.data); // ✅ ONLY data array
        setMeta(res.meta);
      } else {
        setCategories([]);
        setMeta(null);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to fetch categories",
        variant: "destructive",
      });
      setCategories([]); // Ensure categories is always an array
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setSelectedCategory(null);
    setFormData({ name: '', description: '' });
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setModalOpen(true);
  };

  const openDeleteModal = (category: Category) => {
    setSelectedCategory(category);
    setDeleteModalOpen(true);
  };

  //   const handleSubmit = async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setSaving(true);

  //     const payload = {
  //       name: formData.name,
  //       description: formData.description || undefined,
  //     };

  //     // const response = selectedCategory
  //     //   ? await api.updateCategory(selectedCategory.id, payload)
  //     //   : await api.createCategory(payload as Category);

  //     try {
  //   await api.createCategory(payload);

  //   toast({
  //     title: "Success",
  //     description: selectedCategory
  //       ? "Category updated successfully"
  //       : "Category added successfully",
  //   });
  //   setModalOpen(false);
  //   fetchCategories();
  // } catch (err: any) {
  //   toast({
  //     title: "Error",
  //     description:
  //       err?.response?.data?.message || "Failed to save category",
  //     variant: "destructive",
  //   });
  // }


  //     setSaving(false);
  //   };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
    };

    try {
      if (selectedCategory) {
        // ✅ EDIT MODE → UPDATE
        await api.updateCategory(selectedCategory.id, payload);

        toast({
          title: "Success",
          description: "Category updated successfully",
        });
      } else {
        // ✅ ADD MODE → CREATE
        const res = await api.createCategory(payload);

        if (!res.success) {
          toast({
            title: "Error",
            description: res.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Category added successfully",
        });
      }

      setModalOpen(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message || "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // const handleDelete = async () => {
  //   if (!selectedCategory?.id) {
  //     toast({
  //       title: "Error",
  //       description: "Category ID missing",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   await api.deleteCategory(selectedCategory.id);
  //   fetchCategories();
  // };
  const handleDelete = async () => {
    if (!selectedCategory?.id) return;

    try {
      await api.deleteCategory(selectedCategory.id);

      toast({
        title: "Moved to Recycle Bin",
        description: "Category moved to recycle bin and can be restored",
        duration: 3000,
      });

      setDeleteModalOpen(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err?.response?.data?.message || "Failed to delete category",
        variant: "destructive",
        duration: 3000,
      });
    }
  };


  const closeModal = () => {
    setModalOpen(false);
    setSelectedCategory(null);
    setFormData({ name: "", description: "" });
  };




  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Category Name',
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (item) => (
        <span className="text-muted-foreground">{item.description || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.isDeleted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
          {item.isDeleted ? 'Deleted' : 'Active'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => {
        const { user } = useAuth();
        if (user?.role !== 'admin') return null;

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditModal(item)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDeleteModal(item)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <MainLayout title="Categories">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/50 p-4 rounded-xl border border-border/50">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Category Management</h2>
            <p className="text-sm text-muted-foreground">
              Organize your inventory classifications
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => api.exportCategoriesExcel()}
              className="hover:bg-primary/5 hover:text-primary transition-colors"
            >
              Export Excel
            </Button>
            {/* Only admins can add categories */}
            {/* Only admins can add categories */}
            {user?.role === 'admin' && (
              <Button
                onClick={openAddModal}
                className="gap-2 bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            )}
          </div>
        </div>

        <div className="royal-card overflow-hidden">
          <DataTable
            columns={columns}
            data={categories}
            loading={loading}
            keyExtractor={(item) => item.id}
            emptyMessage="No categories found"
          />
          {/* ✅ NEW: Customizable Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Pagination page={meta?.page} totalPages={meta?.pages} onChange={setPage} />
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCategory ? 'Edit Category' : 'Add New Category'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Diamond, Ruby, Emerald"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : selectedCategory ? 'Update' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">
              {selectedCategory?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
