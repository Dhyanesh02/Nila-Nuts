import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAccounts from '@salesforce/apex/TourPlansController.getAccounts';
import getVisitTypes from '@salesforce/apex/TourPlansController.getVisitTypes';
import getAccountsByType from '@salesforce/apex/TourPlansController.getAccountsByType';
import { NavigationMixin } from 'lightning/navigation';
import { CurrentPageReference } from 'lightning/navigation';
import createVisits from '@salesforce/apex/TourPlansController.createVisits';


export default class AddVisit extends NavigationMixin(LightningElement) {
    @api showHeader = false;
    @track selectedDate = new Date().toISOString().slice(0, 10);
    @track searchTerm = '';
    @track accounts = [];
    @track selectedAccount;
    @track visitType = '';
    @track visitTypeOptions = [];
    @track todayVisits = [];
    @track visitTypeCount = 0;
    @track showSelectedModal = false;
    @track selectedVisits = [];
    searchTimeout;
    recordId;
    @track error;

    @wire(getVisitTypes)
    wiredVisitTypes({ error, data }) {
        if (data) {
            this.visitTypeOptions = data.map(type => ({
                label: type,
                value: type
            }));
        } else if (error) {
            this.showToast('Error', 'Error loading visit types', 'error');
        }
    }

    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            this.recordId = currentPageReference.state?.c__recordId;
        }
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        
        // Clear previous timeout
        clearTimeout(this.searchTimeout);
        
        // Set new timeout for debouncing
        if (this.searchTerm.length >= 2) {
            this.isLoading = true;
            this.searchTimeout = setTimeout(() => {
                getAccounts({ searchKey: this.searchTerm })
                    .then(result => {
                        this.accounts = result;
                        this.isLoading = false;
                    })
                    .catch(error => {
                        this.showToast('Error', error.message, 'error');
                        this.isLoading = false;
                    });
            }, 300); // 300ms delay
        } else {
            this.accounts = [];
            this.isLoading = false;
        }
    }

    handleAccountSelect(event) {
        const selectedId = event.currentTarget.dataset.id;
        const selectedName = event.currentTarget.dataset.name;
        this.selectedAccount = selectedId;
        this.searchTerm = selectedName;
        this.accounts = []; // Clear search results
    }

    handleDateChange(event) {
        const customerName = event.target.name;
        const newDate = event.target.value;
        this.selectedVisits = this.selectedVisits.map(visit => {
            if (visit.customerName === customerName) {
                return { ...visit, date: newDate };
            }
            return visit;
        });
    }

    handleVisitTypeChange(event) {
        this.visitType = event.target.value;
        this.loadVisits();
    }

    loadVisits() {
        if (this.visitType) {
            getAccountsByType({ visitType: this.visitType })
                .then(result => {
                    this.todayVisits = result.map(account => ({
                        customerName: account.Name,
                        city: account.BillingCity,
                        ownerName: account.Owner.Name,
                        isSelected: false,
                        iconClass: 'add-icon',
                        iconSymbol: '+'
                    }));
                    this.error = undefined;
                })
                .catch(error => {
                    this.error = error;
                    this.todayVisits = [];
                });
        } else {
            this.todayVisits = [];
        }
    }

    handleSave() {        
        // Add your save logic here
        this.closeModal();
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

    handleBack() {
        window.history.back();
    }

    handleToggleSelection(event) {
        const customerId = event.currentTarget.dataset.id;
        this.todayVisits = this.todayVisits.map(visit => {
            if (visit.customerName === customerId) {
                visit.isSelected = !visit.isSelected;
                visit.iconClass = visit.isSelected ? 'delete-icon' : 'add-icon';
                visit.iconSymbol = visit.isSelected ? '×' : '+';
                
                if (visit.isSelected) {
                    this.selectedVisits.push({
                        customerName: visit.customerName,
                        city: visit.city,
                        ownerName: visit.ownerName,
                        date: new Date().toISOString().slice(0, 10)
                    });
                } else {
                    this.selectedVisits = this.selectedVisits.filter(
                        v => v.customerName !== visit.customerName
                    );
                }
            }
            return visit;
        });
    }

    handleNext() {
        if (this.selectedVisits.length > 0) {
            this.showSelectedModal = true;
        }
    }

    closeModal() {
        this.showSelectedModal = false;
    }

    saveVisits() {
        if (this.selectedVisits.length === 0) {
            this.showToast('Error', 'Please select visits to save', 'error');
            return;
        }

        const visits = this.selectedVisits.map(visit => ({
            customerName: visit.customerName,
            visitType: this.visitType,
            plannedDate: visit.date
        }));

        createVisits({ visits: visits })
            .then(() => {
                this.showToast('Success', 'Visits created successfully', 'success');
                window.history.back();
            })
            .catch(error => {
                console.error('Error creating visits:', error);
                this.showToast(
                    'Error',
                    error.body?.message || 'Error creating visits',
                    'error'
                );
            });
    }

    get iconName() {
        return this.isSelected ? 'utility:close' : 'utility:add';
    }

    get iconClass() {
        return this.isSelected ? 'delete-icon' : 'add-icon';
    }

    get noVisitsMessage() {
        return this.visitType ? 'No accounts found for selected type' : 'Please select a visit type';
    }
}