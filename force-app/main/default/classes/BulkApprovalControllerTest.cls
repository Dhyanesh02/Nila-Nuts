@IsTest
private class BulkApprovalControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test user
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User testUser = new User(
            Alias = 'tuser',
            Email = 'testuser@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser@test.com' + System.currentTimeMillis()
        );
        insert testUser;

        // Create test Leave record
        Leave__c leave = new Leave__c(
            OwnerId = testUser.Id,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(5),
            Status__c = 'Pending'
        );
        insert leave;

        // Create test Expense record
        Expense__c expense = new Expense__c(
            OwnerId = testUser.Id,
            Amount__c = 1000,
            Status__c = 'Pending'
        );
        insert expense;

        // Submit records for approval
        Approval.ProcessSubmitRequest leaveReq = new Approval.ProcessSubmitRequest();
        leaveReq.setObjectId(leave.Id);
        Approval.ProcessSubmitRequest expenseReq = new Approval.ProcessSubmitRequest();
        expenseReq.setObjectId(expense.Id);
        
        Test.startTest();
        Approval.ProcessResult[] results = Approval.process(new List<Approval.ProcessSubmitRequest>{
            leaveReq, expenseReq
        });
        Test.stopTest();
    }

    @IsTest
    static void testGetPendingApprovals() {
        Test.startTest();
        List<BulkApprovalController.ApprovalWrapper> approvals = BulkApprovalController.getPendingApprovals(
            null, null, null
        );
        Test.stopTest();

        System.assert(!approvals.isEmpty(), 'Should return pending approvals');
        System.assertEquals(2, approvals.size(), 'Should return 2 pending approvals');
    }

    @IsTest
    static void testGetPendingApprovalsWithFilters() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Test.startTest();
        // Test Leave filter
        List<BulkApprovalController.ApprovalWrapper> leaveApprovals = BulkApprovalController.getPendingApprovals(
            'Leave__c', testUser.Id, Date.today()
        );
        
        // Test Expense filter
        List<BulkApprovalController.ApprovalWrapper> expenseApprovals = BulkApprovalController.getPendingApprovals(
            'Expense__c', testUser.Id, Date.today()
        );
        Test.stopTest();

        System.assertEquals(1, leaveApprovals.size(), 'Should return 1 leave approval');
        System.assertEquals(1, expenseApprovals.size(), 'Should return 1 expense approval');
    }

    @IsTest
    static void testProcessApprovals() {
        List<ProcessInstanceWorkitem> workItems = [
            SELECT Id 
            FROM ProcessInstanceWorkitem 
            WHERE ProcessInstance.Status = 'Pending'
        ];

        List<Id> recordIds = new List<Id>();
        for(ProcessInstanceWorkitem workItem : workItems) {
            recordIds.add(workItem.Id);
        }

        Test.startTest();
        BulkApprovalController.processApprovals(recordIds, 'Approve');
        Test.stopTest();

        // Verify approvals were processed
        List<ProcessInstanceWorkitem> remainingWorkItems = [
            SELECT Id 
            FROM ProcessInstanceWorkitem 
            WHERE Id IN :recordIds
        ];
        System.assertEquals(0, remainingWorkItems.size(), 'All work items should be processed');
    }

    @IsTest
    static void testProcessApprovalsError() {
        Test.startTest();
        try {
            BulkApprovalController.processApprovals(
                new List<Id>{'invalid_id'}, 
                'Approve'
            );
            System.assert(false, 'Should throw an exception');
        } catch(AuraHandledException e) {
            System.assert(e.getMessage().contains('Error processing approvals'), 
                'Should throw appropriate error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetAllUsers() {
        Test.startTest();
        List<User> users = BulkApprovalController.getAllUsers();
        Test.stopTest();

        System.assert(!users.isEmpty(), 'Should return active users');
        
        Boolean foundTestUser = false;
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        for(User u : users) {
            if(u.Id == testUser.Id) {
                foundTestUser = true;
                break;
            }
        }
        System.assert(foundTestUser, 'Should include test user in results');
    }

    @IsTest
    static void testApprovalWrapper() {
        BulkApprovalController.ApprovalWrapper wrapper = new BulkApprovalController.ApprovalWrapper();
        
        wrapper.id = 'test_id';
        wrapper.targetObjectId = 'target_id';
        wrapper.recordName = 'Test Record';
        wrapper.relatedTo = 'Leave';
        wrapper.submittedBy = 'Test User';
        wrapper.submittedDate = DateTime.now();

        System.assertEquals('test_id', wrapper.id, 'Id should be set correctly');
        System.assertEquals('target_id', wrapper.targetObjectId, 'Target object id should be set correctly');
        System.assertEquals('Test Record', wrapper.recordName, 'Record name should be set correctly');
        System.assertEquals('Leave', wrapper.relatedTo, 'Related to should be set correctly');
        System.assertEquals('Test User', wrapper.submittedBy, 'Submitted by should be set correctly');
        System.assertNotEquals(null, wrapper.submittedDate, 'Submitted date should be set');
    }
} 