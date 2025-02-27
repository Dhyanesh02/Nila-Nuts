public with sharing class BulkApprovalController {
    @AuraEnabled(cacheable=true)
    public static List<ApprovalWrapper> getPendingApprovals(String relatedTo, String submittedBy, Date submittedDate) {
        try {
            String query = 'SELECT Id, ProcessInstance.TargetObjectId, ProcessInstance.TargetObject.Name, ' +
                          'ProcessInstance.TargetObject.Type, ProcessInstance.SubmittedBy.Name, ' +
                          'ProcessInstance.CreatedDate ' +
                          'FROM ProcessInstanceWorkitem ' +
                          'WHERE ProcessInstance.Status = \'Pending\' ';
            
            if(String.isNotBlank(relatedTo)) {
                if(relatedTo == 'Leave__c') {
                    query += 'AND ProcessInstance.TargetObject.Type = \'Leave__c\' ';
                } else if(relatedTo == 'Expense__c') {
                    query += 'AND ProcessInstance.TargetObject.Type = \'Expense__c\' ';
                }
            }
            
            if(String.isNotBlank(submittedBy)) {
                query += 'AND ProcessInstance.SubmittedBy.Id = :submittedBy ';
            }
            
            if(submittedDate != null) {
                DateTime startOfDay = DateTime.newInstance(
                    submittedDate.year(), 
                    submittedDate.month(), 
                    submittedDate.day(), 
                    0, 0, 0
                );
                DateTime endOfDay = startOfDay.addDays(1);
                query += 'AND ProcessInstance.CreatedDate >= :startOfDay AND ProcessInstance.CreatedDate < :endOfDay ';
            }
            
            query += 'ORDER BY ProcessInstance.CreatedDate DESC';
            
            List<ProcessInstanceWorkitem> pendingApprovals = Database.query(query);
            List<ApprovalWrapper> wrappers = new List<ApprovalWrapper>();
            
            for(ProcessInstanceWorkitem piw : pendingApprovals) {
                ApprovalWrapper wrapper = new ApprovalWrapper();
                wrapper.id = piw.Id;
                wrapper.targetObjectId = piw.ProcessInstance.TargetObjectId;
                wrapper.recordName = piw.ProcessInstance.TargetObject.Name;
                String relatedToType = piw.ProcessInstance.TargetObject.Type;
                wrapper.relatedTo = relatedToType.removeEnd('__c');
                wrapper.submittedBy = piw.ProcessInstance.SubmittedBy.Name;
                wrapper.submittedDate = piw.ProcessInstance.CreatedDate;
                wrappers.add(wrapper);
            }
            return wrappers;
        } catch(Exception e) {
            throw new AuraHandledException('Error loading approval requests: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void processApprovals(List<Id> recordIds, String action) {
        List<Approval.ProcessWorkitemRequest> requests = new List<Approval.ProcessWorkitemRequest>();
        
        for(Id recordId : recordIds) {
            Approval.ProcessWorkitemRequest req = new Approval.ProcessWorkitemRequest();
            req.setAction(action);
            req.setWorkitemId(recordId);
            requests.add(req);
        }
        
        try {
            Approval.ProcessResult[] results = Approval.process(requests);
        } catch(Exception e) {
            throw new AuraHandledException('Error processing approvals: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getAllUsers() {
        return [
            SELECT Id, Name 
            FROM User 
            WHERE IsActive = true 
            ORDER BY Name 
            LIMIT 100
        ];
    }

    public class ApprovalWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public Id targetObjectId;
        @AuraEnabled public String recordName;
        @AuraEnabled public String relatedTo;
        @AuraEnabled public String submittedBy;
        @AuraEnabled public Datetime submittedDate;
    }
}