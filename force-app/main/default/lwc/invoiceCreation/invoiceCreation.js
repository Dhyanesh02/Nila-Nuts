import { LightningElement, track, wire, api } from 'lwc';
import getProductFamilies from '@salesforce/apex/VisitController.getProductFamilies';
import getProductsByFamily from '@salesforce/apex/VisitController.getProductsByFamily';
// import createInvoiceItems from '@salesforce/apex/VisitController.createInvoiceItems';
import createInvoiceWithItems from '@salesforce/apex/VisitController.createInvoiceWithItems';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';


export default class InvoiceCreation extends LightningElement {
    @api distributorName;
    @api accountId;
    @api invoiceId;
    @api contactId;
    @api billToContact;
    @track categoryOptions = [];
    @track productList = [];
    @track selectedProducts = new Map();
    @track selectedFamily;
    currentDate = new Date().toLocaleDateString('en-GB');
    isLoading = false;
    @track dueDate;
    @track showReviewModal = false;
    @track selectedItemsList = [];
    @track totalAmount = 0;
    @track dueDateApi;
    @track isReviewed = false;

    connectedCallback() {
        this.loadCategories();
    }

    async loadCategories() {
        try {
            const result = await getProductFamilies();
            if (result) {
                this.categoryOptions = result.map(value => ({
                    label: value,
                    value: value
                }));
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showToast('Error', 'Error loading categories', 'error');
        }
    }

    handleCategoryChange(event) {
        const selectedFamily = event.target.value;
        this.selectedFamily = selectedFamily;
        if (selectedFamily) {
            this.loadProducts(selectedFamily);
            this.isReviewed = false;
        } else {
            this.productList = [];
        }
    }

    async loadProducts(family) {
        try {
            this.isLoading = true;
            const result = await getProductsByFamily({ family });
            if (result) {
                this.productList = result.map(product => {
                    const savedProduct = this.selectedProducts.get(product.Id);
                    const productData = {
                        Id: product.Id,
                        Name: product.Name,
                        Price__c: product.Price__c,
                        Product_Image__c: product.Product_Image__c,
                        Product_Category__c: product.Product_Category__c,
                        quantity: savedProduct ? savedProduct.quantity : '',
                        discount: savedProduct ? savedProduct.discount : '',
                        Total: savedProduct ? savedProduct.Total : ''
                    };
                    return productData;
                });
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.showToast('Error', 'Error loading products', 'error');
            this.productList = [];
        } finally {
            this.isLoading = false;
        }
    }

    handleQuantityChange(event) {
        const productId = event.target.dataset.productId;
        const quantity = parseInt(event.target.value);
        this.updateProductCalculations(productId, quantity, 'quantity');
        this.isReviewed = false;
    }

    handleDiscountChange(event) {
        const productId = event.target.dataset.productId;
        const discount = parseFloat(event.target.value);
        this.updateProductCalculations(productId, discount, 'discount');
        this.isReviewed = false;
    }

    updateProductCalculations(productId, value, field) {
        const updatedList = this.productList.map(product => {
            if (product.Id === productId) {
                const updatedProduct = { ...product };
                updatedProduct[field] = value;
                
                const quantity = field === 'quantity' ? value : product.quantity;
                const discount = field === 'discount' ? value : product.discount;
                const price = product.Price__c || 0;
                
                const subtotal = quantity * price;
                const discountAmount = (subtotal * discount) / 100;
                updatedProduct.Total = (subtotal - discountAmount).toFixed(2);
                
                if (quantity > 0) {
                    this.selectedProducts.set(productId, { ...updatedProduct });
                } else {
                    this.selectedProducts.delete(productId);
                }
                
                return updatedProduct;
            }
            return product;
        });

        this.productList = [...updatedList];
    }

    get minDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    handleDueDateChange(event) {
        const selectedDate = event.target.value;
        if (selectedDate < this.minDate) {
            this.showToast('Error', 'Please select today or a future date', 'error');
            event.target.value = this.minDate;
            return;
        }
        // Store the original date value for API calls
        this.dueDateApi = selectedDate;
        // Convert the date to dd/mm/yyyy format for display only
        const dateObj = new Date(selectedDate);
        this.dueDate = dateObj.toLocaleDateString('en-GB');
    }

    handleReview() {
        this.selectedItemsList = Array.from(this.selectedProducts.values())
            .filter(product => product.quantity > 0);
        
        if (this.selectedItemsList.length === 0) {
            this.showToast('Error', 'Please select at least one product', 'error');
            return;
        }

        if (!this.dueDate) {
            this.showToast('Error', 'Please select a due date', 'error');
            return;
        }

        this.totalAmount = this.selectedItemsList
            .reduce((sum, product) => sum + parseFloat(product.Total || 0), 0)
            .toFixed(2);

        this.isReviewed = true;
        this.showReviewModal = true;
    }

    handleReviewClose() {
        this.showReviewModal = false;
    }

    handleSave() {
        if (!this.isReviewed) {
            this.showToast('Error', 'Please review the invoice before saving', 'error');
            return;
        }

        const invoiceItems = Array.from(this.selectedProducts.values())
            .filter(product => product.quantity > 0)
            .map(product => ({
                productId: product.Id,
                quantity: parseInt(product.quantity),
                discount: parseFloat(product.discount || 0),
                price: parseFloat(product.Price__c),
                total: parseFloat(product.Total),
                productCategory: product.Product_Category__c
            }));

        // Ensure proper data types and remove any invalid entries
        const cleanedItems = invoiceItems.filter(item => 
            item.quantity > 0 && 
            !isNaN(item.price) && 
            !isNaN(item.total)
        );

        createInvoiceWithItems({ 
            accountId: this.accountId,
            contactId: this.contactId,
            billToContact: this.billToContact,
            totalAmount: parseFloat(this.totalAmount),
            dueDate: this.dueDateApi, // Use the original date format for API
            items: cleanedItems 
        })
        .then(() => {
            this.showToast('Success', 'Invoice created successfully', 'success');
            this.selectedProducts.clear();
            this.dispatchEvent(new CustomEvent('save'));
        })
        .catch(error => {
            console.error('Error creating invoice:', error);
            this.showToast('Error', error.body?.message || 'Error creating invoice', 'error');
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}