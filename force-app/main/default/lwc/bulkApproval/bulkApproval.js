import { LightningElement, track, wire } from 'lwc';
import getPendingApprovals from '@salesforce/apex/BulkApprovalController.getPendingApprovals';
import processApprovals from '@salesforce/apex/BulkApprovalController.processApprovals';
import getAllUsers from '@salesforce/apex/BulkApprovalController.getAllUsers';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class BulkApproval extends NavigationMixin(LightningElement) {
    @track approvalRequests = [];
    @track selectedRows = [];
    @track selectedRelatedTo = '';
    @track selectedSubmitter = '';
    @track selectedDate;
    @track userOptions = [];

    columns = [
        { label: 'Name', fieldName: 'recordName', type: 'text' },
        { label: 'Related to', fieldName: 'relatedTo', type: 'text' },
        { label: 'Submitted by', fieldName: 'submittedBy', type: 'text' },
        { label: 'Submitted date', fieldName: 'submittedDate', type: 'date' },
        { label: 'Comments', fieldName: 'comments', type: 'text' }
    ];

    relatedToOptions = [
        { label: 'All', value: '' },
        { label: 'Leave', value: 'Leave__c' },
        { label: 'Expense', value: 'Expenses__c' }
    ];

    connectedCallback() {
        this.loadUsers();
        this.loadApprovals();
    }

    async loadUsers() {
        try {
            const users = await getAllUsers();
            this.userOptions = [
                { label: 'Select User', value: '' },
                ...users.map(user => ({
                    label: user.Name,
                    value: user.Id
                }))
            ];
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadApprovals() {
        try {
            const result = await getPendingApprovals({
                relatedTo: this.selectedRelatedTo,
                submittedBy: this.selectedSubmitter,
                submittedDate: this.selectedDate
            });
            this.approvalRequests = result || [];
            console.log('Approvals loaded:', this.approvalRequests);
        } catch (error) {
            console.error('Error loading approvals:', error);
            this.showToast('Error', 'Error loading approval requests: ' + (error.body?.message || error.message), 'error');
            this.approvalRequests = [];
        }
    }

    handleRelatedToChange(event) {
        this.selectedRelatedTo = event.target.value;
        this.loadApprovals();
    }

    handleSubmitterChange(event) {
        this.selectedSubmitter = event.target.value;
        this.loadApprovals();
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
        this.loadApprovals();
    }

    handleSelectAll(event) {
        const checkboxes = this.template.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (checkbox !== event.target) {
                checkbox.checked = event.target.checked;
            }
        });
        this.updateSelectedRows();
    }

    handleRowSelection(event) {
        this.updateSelectedRows();
    }

    updateSelectedRows() {
        const checkboxes = this.template.querySelectorAll('input[type="checkbox"][data-id]');
        this.selectedRows = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.dataset.id);
    }

    async handleApprove() {
        if (!this.selectedRows.length) {
            this.showToast('Error', 'Please select records to approve', 'error');
            return;
        }
        await this.processApprovals('Approve');
    }

    async handleReject() {
        if (!this.selectedRows.length) {
            this.showToast('Error', 'Please select records to reject', 'error');
            return;
        }
        await this.processApprovals('Reject');
    }

    async processApprovals(action) {
        try {
            await processApprovals({ 
                recordIds: this.selectedRows, 
                action: action 
            });
            
            this.approvalRequests = this.approvalRequests.filter(
                request => !this.selectedRows.includes(request.id)
            );
            
            this.showToast('Success', `Records ${action}d successfully`, 'success');
            this.selectedRows = [];
        } catch (error) {
            console.error('Error processing approvals:', error);
            this.showToast('Error', error.body?.message || 'Error processing approvals', 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    get formattedApprovalRequests() {
        return this.approvalRequests.map(request => ({
            ...request,
            relatedTo: this.formatRelatedTo(request.relatedTo),
            formattedDate: this.formatDate(request.submittedDate)
        }));
    }

    formatRelatedTo(value) {
        if (value === 'Leave__c') return 'Leave';
        if (value === 'Expenses__c') return 'Expense';
        return value;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }

    navigateToRecord(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordid;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        });
    }
}